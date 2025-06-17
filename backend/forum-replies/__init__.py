import azure.functions as func
import json
import logging
from datetime import datetime, timezone
import uuid
import sys
import os

# Add the parent directory to the Python path to import db_helpers
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_helpers import get_container

def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Handle Plant Care Forum Replies operations
    GET: Retrieve replies for a topic
    POST: Create new reply
    PUT: Update reply (vote, mark as answer)
    DELETE: Delete a reply by replyId
    """
    
    logging.info('Plant Care Forum Replies function processed a request.')
    
    try:
        method = req.method
        
        if method == "GET":
            return handle_get_replies(req)
        elif method == "POST":
            return handle_create_reply(req)
        elif method == "PUT":
            return handle_update_reply(req)
        elif method == "DELETE":
            return handle_delete_reply(req)
        else:
            return func.HttpResponse(
                json.dumps({"error": "Method not allowed"}),
                status_code=405,
                mimetype="application/json"
            )
            
    except Exception as e:
        logging.error(f"Error in forum replies function: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

def handle_get_replies(req: func.HttpRequest) -> func.HttpResponse:
    """Get replies for a specific topic"""
    
    try:
        topic_id = req.params.get('topicId')
        category = req.params.get('category')  # Need category for partition key
        
        if not topic_id or not category:
            return func.HttpResponse(
                json.dumps({"error": "Missing topicId or category parameter"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Get forum container using updated db_helpers
        container = get_container("forum")
        
        # Get replies for topic (replies have same category as parent topic)
        query = "SELECT * FROM c WHERE c.type = 'reply' AND c.topicId = @topicId AND c.category = @category ORDER BY c.timestamp ASC"
        parameters = [
            {"name": "@topicId", "value": topic_id},
            {"name": "@category", "value": category}
        ]
        
        replies = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=False  # Single partition query
        ))
        
        # Update topic view count
        try:
            # Get topic first to update views
            topic_query = "SELECT * FROM c WHERE c.id = @topicId AND c.type = 'topic' AND c.category = @category"
            topic_items = list(container.query_items(
                query=topic_query,
                parameters=parameters,
                enable_cross_partition_query=False
            ))
            
            if topic_items:
                topic = topic_items[0]
                topic['views'] = topic.get('views', 0) + 1
                container.replace_item(item=topic['id'], body=topic)
                
        except Exception as e:
            logging.warning(f"Failed to update view count: {str(e)}")
        
        return func.HttpResponse(
            json.dumps({"replies": replies}, default=str),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error getting forum replies: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Failed to get replies: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def handle_create_reply(req: func.HttpRequest) -> func.HttpResponse:
    """Create a new reply to a topic"""
    
    try:
        req_body = req.get_json()
        
        # Validate required fields
        required_fields = ['topicId', 'content', 'author', 'category']
        for field in required_fields:
            if not req_body.get(field):
                return func.HttpResponse(
                    json.dumps({"error": f"Missing required field: {field}"}),
                    status_code=400,
                    mimetype="application/json"
                )
        
        # Get forum container using updated db_helpers
        container = get_container("forum")
        
        # Create reply document
        reply_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        reply = {
            "id": reply_id,
            "type": "reply",
            "topicId": req_body['topicId'],
            "category": req_body['category'],  # Same category as parent topic for partition key
            "content": req_body['content'].strip(),
            "author": req_body['author'],
            "authorType": req_body.get('authorType', 'customer'),
            "timestamp": timestamp,
            "votes": 0,
            "isAnswer": False,
            "parentReplyId": req_body.get('parentReplyId')  # For nested replies
        }
        
        # Save reply to database
        container.create_item(body=reply)
        
        # Update topic reply count and last activity
        try:
            topic_query = "SELECT * FROM c WHERE c.id = @topicId AND c.type = 'topic' AND c.category = @category"
            parameters = [
                {"name": "@topicId", "value": req_body['topicId']},
                {"name": "@category", "value": req_body['category']}
            ]
            
            topic_items = list(container.query_items(
                query=topic_query,
                parameters=parameters,
                enable_cross_partition_query=False
            ))
            
            if topic_items:
                topic = topic_items[0]
                topic['replies'] = topic.get('replies', 0) + 1
                topic['lastActivity'] = timestamp
                container.replace_item(item=topic['id'], body=topic)
                
        except Exception as e:
            logging.warning(f"Failed to update topic stats: {str(e)}")
        
        logging.info(f"Created forum reply: {reply_id} for topic: {req_body['topicId']}")
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "replyId": reply_id,
                "message": "Reply created successfully"
            }),
            status_code=201,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error creating forum reply: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Failed to create reply: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def handle_update_reply(req: func.HttpRequest) -> func.HttpResponse:
    """Update a reply (vote, mark as answer)"""
    
    try:
        req_body = req.get_json()
        reply_id = req_body.get('replyId')
        category = req_body.get('category')
        action = req_body.get('action')  # 'vote', 'mark_answer', 'unmark_answer'
        
        if not reply_id or not category or not action:
            return func.HttpResponse(
                json.dumps({"error": "Missing replyId, category, or action"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Get forum container using updated db_helpers
        container = get_container("forum")
        
        # Get the reply
        try:
            reply_query = "SELECT * FROM c WHERE c.id = @replyId AND c.type = 'reply' AND c.category = @category"
            parameters = [
                {"name": "@replyId", "value": reply_id},
                {"name": "@category", "value": category}
            ]
            
            reply_items = list(container.query_items(
                query=reply_query,
                parameters=parameters,
                enable_cross_partition_query=False
            ))
            
            if not reply_items:
                return func.HttpResponse(
                    json.dumps({"error": "Reply not found"}),
                    status_code=404,
                    mimetype="application/json"
                )
                
            reply = reply_items[0]
            
        except Exception as e:
            return func.HttpResponse(
                json.dumps({"error": "Reply not found"}),
                status_code=404,
                mimetype="application/json"
            )
        
        # Handle different actions
        if action == 'vote':
            vote_type = req_body.get('voteType', 'up')  # 'up' or 'down'
            if vote_type == 'up':
                reply['votes'] = reply.get('votes', 0) + 1
            else:
                reply['votes'] = reply.get('votes', 0) - 1
                
        elif action == 'mark_answer':
            reply['isAnswer'] = True
            # Update topic to mark as answered
            try:
                topic_query = "SELECT * FROM c WHERE c.id = @topicId AND c.type = 'topic' AND c.category = @category"
                topic_params = [
                    {"name": "@topicId", "value": reply['topicId']},
                    {"name": "@category", "value": category}
                ]
                
                topic_items = list(container.query_items(
                    query=topic_query,
                    parameters=topic_params,
                    enable_cross_partition_query=False
                ))
                
                if topic_items:
                    topic = topic_items[0]
                    topic['isAnswered'] = True
                    container.replace_item(item=topic['id'], body=topic)
                    
            except Exception as e:
                logging.warning(f"Failed to update topic answered status: {str(e)}")
                
        elif action == 'unmark_answer':
            reply['isAnswer'] = False
            # Check if there are other answers, if not, mark topic as unanswered
            try:
                other_answers_query = "SELECT * FROM c WHERE c.type = 'reply' AND c.topicId = @topicId AND c.category = @category AND c.isAnswer = true AND c.id != @replyId"
                other_params = [
                    {"name": "@topicId", "value": reply['topicId']},
                    {"name": "@category", "value": category},
                    {"name": "@replyId", "value": reply_id}
                ]
                
                other_answers = list(container.query_items(
                    query=other_answers_query,
                    parameters=other_params,
                    enable_cross_partition_query=False
                ))
                
                if len(other_answers) == 0:  # No other answers exist
                    topic_query = "SELECT * FROM c WHERE c.id = @topicId AND c.type = 'topic' AND c.category = @category"
                    topic_params = [
                        {"name": "@topicId", "value": reply['topicId']},
                        {"name": "@category", "value": category}
                    ]
                    
                    topic_items = list(container.query_items(
                        query=topic_query,
                        parameters=topic_params,
                        enable_cross_partition_query=False
                    ))
                    
                    if topic_items:
                        topic = topic_items[0]
                        topic['isAnswered'] = False
                        container.replace_item(item=topic['id'], body=topic)
                        
            except Exception as e:
                logging.warning(f"Failed to update topic answered status: {str(e)}")
        
        # Save updated reply
        container.replace_item(item=reply_id, body=reply)
        
        logging.info(f"Updated forum reply: {reply_id} with action: {action}")
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "message": f"Reply {action} successful"
            }),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error updating forum reply: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Failed to update reply: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def handle_delete_reply(req: func.HttpRequest) -> func.HttpResponse:
    """Delete a forum reply by replyId"""
    try:
        reply_id = req.params.get('replyId')
        category = req.params.get('category')
        if not reply_id or not category:
            return func.HttpResponse(
                json.dumps({"error": "Missing replyId or category parameter"}),
                status_code=400,
                mimetype="application/json"
            )
        container = get_container("forum")
        # Find the reply (need partition key: category)
        query = "SELECT * FROM c WHERE c.type = 'reply' AND c.id = @id AND c.category = @category"
        items = list(container.query_items(
            query=query,
            parameters=[{"name": "@id", "value": reply_id}, {"name": "@category", "value": category}],
            enable_cross_partition_query=False
        ))
        if not items:
            return func.HttpResponse(
                json.dumps({"error": "Reply not found"}),
                status_code=404,
                mimetype="application/json"
            )
        reply = items[0]
        # Delete the reply using id and partition key (category)
        container.delete_item(item=reply_id, partition_key=category)
        # Optionally decrement parent topic's reply count
        try:
            topic_query = "SELECT * FROM c WHERE c.id = @topicId AND c.type = 'topic' AND c.category = @category"
            topic_items = list(container.query_items(
                query=topic_query,
                parameters=[{"name": "@topicId", "value": reply.get('topicId')}, {"name": "@category", "value": category}],
                enable_cross_partition_query=False
            ))
            if topic_items:
                topic = topic_items[0]
                topic['replies'] = max(0, topic.get('replies', 1) - 1)
                container.replace_item(item=topic['id'], body=topic)
        except Exception as e:
            logging.warning(f"Failed to update topic reply count after deleting reply: {str(e)}")
        return func.HttpResponse(
            json.dumps({"success": True, "message": "Reply deleted"}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": f"Failed to delete reply: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )