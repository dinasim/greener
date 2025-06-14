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
    Handle Plant Care Forum operations
    GET: Retrieve forum topics
    POST: Create new forum topic
    """
    
    logging.info('Plant Care Forum function processed a request.')
    
    try:
        method = req.method
        
        if method == "GET":
            return handle_get_topics(req)
        elif method == "POST":
            return handle_create_topic(req)
        else:
            return func.HttpResponse(
                json.dumps({"error": "Method not allowed"}),
                status_code=405,
                mimetype="application/json"
            )
            
    except Exception as e:
        logging.error(f"Error in plant care forum function: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

def handle_get_topics(req: func.HttpRequest) -> func.HttpResponse:
    """Get forum topics with filtering and search"""
    
    try:
        # Get query parameters
        category = req.params.get('category', 'all')
        search = req.params.get('search', '')
        limit = int(req.params.get('limit', '20'))
        offset = int(req.params.get('offset', '0'))
        sort_by = req.params.get('sort', 'lastActivity')  # lastActivity, created, votes
        
        # Get forum container using updated db_helpers
        container = get_container("forum")
        
        # Build query with proper partition key usage
        if category != 'all':
            # Efficient single-partition query
            query = "SELECT * FROM c WHERE c.type = 'topic' AND c.category = @category"
            parameters = [{"name": "@category", "value": category}]
            
            if search:
                query += " AND (CONTAINS(LOWER(c.title), LOWER(@search)) OR CONTAINS(LOWER(c.content), LOWER(@search)))"
                parameters.append({"name": "@search", "value": search})
                
            enable_cross_partition = False
        else:
            # Cross-partition query when needed
            query = "SELECT * FROM c WHERE c.type = 'topic'"
            parameters = []
            
            if search:
                query += " AND (CONTAINS(LOWER(c.title), LOWER(@search)) OR CONTAINS(LOWER(c.content), LOWER(@search)))"
                parameters.append({"name": "@search", "value": search})
                
            enable_cross_partition = True
        
        # Add sorting
        if sort_by == 'lastActivity':
            query += " ORDER BY c.lastActivity DESC"
        elif sort_by == 'created':
            query += " ORDER BY c.timestamp DESC"
        elif sort_by == 'votes':
            query += " ORDER BY c.votes DESC"
        
        # Add pagination
        query += f" OFFSET {offset} LIMIT {limit}"
        
        # Execute query
        topics = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=enable_cross_partition
        ))
        
        # Get category statistics
        stats_query = """
        SELECT c.category, COUNT(1) as count
        FROM c 
        WHERE c.type = 'topic'
        GROUP BY c.category
        """
        
        stats_items = list(container.query_items(
            query=stats_query,
            enable_cross_partition_query=True
        ))
        
        category_stats = {item['category']: item['count'] for item in stats_items}
        
        response_data = {
            "topics": topics,
            "pagination": {
                "offset": offset,
                "limit": limit,
                "hasMore": len(topics) == limit
            },
            "categoryStats": category_stats,
            "total": sum(category_stats.values()) if category == 'all' else category_stats.get(category, 0)
        }
        
        return func.HttpResponse(
            json.dumps(response_data, default=str),
            status_code=200,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error getting forum topics: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Failed to get topics: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def handle_create_topic(req: func.HttpRequest) -> func.HttpResponse:
    """Create a new forum topic"""
    
    try:
        req_body = req.get_json()
        
        # Validate required fields
        required_fields = ['title', 'content', 'author', 'category']
        for field in required_fields:
            if not req_body.get(field):
                return func.HttpResponse(
                    json.dumps({"error": f"Missing required field: {field}"}),
                    status_code=400,
                    mimetype="application/json"
                )
        
        # Validate category
        valid_categories = ['general', 'disease', 'pests', 'watering', 'lighting', 'fertilizer', 'repotting', 'indoor', 'outdoor']
        if req_body['category'] not in valid_categories:
            return func.HttpResponse(
                json.dumps({"error": f"Invalid category. Must be one of: {', '.join(valid_categories)}"}),
                status_code=400,
                mimetype="application/json"
            )
        
        # Get forum container using updated db_helpers
        container = get_container("forum")
        
        # Create topic document
        topic_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        topic = {
            "id": topic_id,
            "type": "topic",
            "title": req_body['title'].strip(),
            "content": req_body['content'].strip(),
            "author": req_body['author'],
            "category": req_body['category'],  # This is our partition key
            "tags": req_body.get('tags', []),
            "timestamp": timestamp,
            "lastActivity": timestamp,
            "replies": 0,
            "views": 0,
            "votes": 0,
            "isAnswered": False,
            "isPinned": False,
            "isClosed": False,
            "authorType": req_body.get('authorType', 'customer')  # customer or business
        }
        
        # Save to database with category as partition key
        container.create_item(body=topic)
        
        logging.info(f"Created forum topic: {topic_id} in category: {req_body['category']}")
        
        return func.HttpResponse(
            json.dumps({
                "success": True,
                "topicId": topic_id,
                "message": "Topic created successfully"
            }),
            status_code=201,
            mimetype="application/json"
        )
        
    except Exception as e:
        logging.error(f"Error creating forum topic: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Failed to create topic: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )