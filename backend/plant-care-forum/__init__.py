
import azure.functions as func
import json
import logging
from datetime import datetime, timezone
import uuid
import sys
import os

# Add the parent directory to the Python path to import helpers
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_helpers import get_container
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Handle Plant Care Forum operations
    GET: Retrieve forum topics
    POST: Create new forum topic
    DELETE: Delete a forum topic by topicId
    PATCH/PUT: Edit a forum topic
    """
    logging.info('Plant Care Forum function processed a request.')

    # Handle OPTIONS method for CORS preflight
    if req.method == 'OPTIONS':
        return handle_options_request()

    try:
        method = req.method

        if method == "GET":
            response = handle_get_topics(req)
        elif method == "POST":
            response = handle_create_topic(req)
        elif method == "DELETE":
            response = handle_delete_topic(req)
        elif method in ("PATCH", "PUT"):
            response = handle_edit_topic(req)
        else:
            response = func.HttpResponse(
                json.dumps({"error": "Method not allowed"}),
                status_code=405,
                mimetype="application/json"
            )

        # Add CORS headers to all responses
        return add_cors_headers(response)

    except Exception as e:
        logging.error(f"Error in plant care forum function: {str(e)}")
        error_response = func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )
        return add_cors_headers(error_response)


def handle_get_topics(req: func.HttpRequest) -> func.HttpResponse:
    """Get forum topics with filtering and search"""
    try:
        # Get query parameters
        category = req.params.get('category', 'all')
        search = req.params.get('search', '')
        limit = int(req.params.get('limit', '20'))
        offset = int(req.params.get('offset', '0'))
        sort_by = req.params.get('sort', 'lastActivity')

        logging.info(
            f"Getting forum topics: category={category}, search='{search}', "
            f"limit={limit}, offset={offset}"
        )

        # Get forum container
        container = get_container("forum")

        # Build query based on category
        if category not in ('all', ''):
            # Single partition query
            query = "SELECT * FROM c WHERE c.type = 'topic' AND c.category = @category"
            parameters = [{"name": "@category", "value": category}]
            enable_cross_partition = False
        else:
            # Cross-partition query for all categories
            query = "SELECT * FROM c WHERE c.type = 'topic'"
            parameters = []
            enable_cross_partition = True

        # Add search filter if provided
        if search:
            query += " AND (CONTAINS(LOWER(c.title), LOWER(@search)) OR CONTAINS(LOWER(c.content), LOWER(@search)))"
            parameters.append({"name": "@search", "value": search})

        # Add sorting
        if sort_by == 'lastActivity':
            query += " ORDER BY c.lastActivity DESC"
        elif sort_by == 'created':
            query += " ORDER BY c.timestamp DESC"
        elif sort_by == 'votes':
            query += " ORDER BY c.votes DESC"

        # Add pagination
        query += f" OFFSET {offset} LIMIT {limit}"

        logging.info(f"Executing query: {query}")

        # Execute query
        topics = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=enable_cross_partition
        ))

        # Get category statistics without GROUP BY - use separate queries
        category_stats = {}
        categories = ['general', 'disease', 'pests', 'watering', 'lighting', 'fertilizer', 'repotting', 'indoor', 'outdoor']

        for cat in categories:
            try:
                count_query = "SELECT VALUE COUNT(1) FROM c WHERE c.type = 'topic' AND c.category = @category"
                count_result = list(container.query_items(
                    query=count_query,
                    parameters=[{"name": "@category", "value": cat}],
                    enable_cross_partition_query=False
                ))
                category_stats[cat] = count_result[0] if count_result else 0
            except Exception as e:
                logging.warning(f"Could not get count for category {cat}: {str(e)}")
                category_stats[cat] = 0

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

        logging.info(f"Returning {len(topics)} topics")

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
        logging.info("Creating new forum topic")

        req_body = req.get_json()
        logging.info(f"Request body: {json.dumps(req_body, indent=2)}")

        # Validate required fields
        required_fields = ['title', 'content', 'author', 'category']
        for field in required_fields:
            if not req_body.get(field):
                logging.error(f"Missing required field: {field}")
                return func.HttpResponse(
                    json.dumps({"error": f"Missing required field: {field}"}),
                    status_code=400,
                    mimetype="application/json"
                )

        # Validate category
        valid_categories = ['general', 'disease', 'pests', 'watering', 'lighting', 'fertilizer', 'repotting', 'indoor', 'outdoor']
        if req_body['category'] not in valid_categories:
            logging.error(f"Invalid category: {req_body['category']}")
            return func.HttpResponse(
                json.dumps({"error": f"Invalid category. Must be one of: {', '.join(valid_categories)}"}),
                status_code=400,
                mimetype="application/json"
            )

        # --- Robust author type resolution (never fail the request here) ---
        import requests
        user_email = req_body.get('author')
        user_profile_url = os.environ.get('USER_PROFILE_URL') or 'https://usersfunctions.azurewebsites.net/api/user-profile'

        # Start with client-provided authorType if present
        author_type = (req_body.get('authorType') or '').strip().lower()
        if author_type in ('business', 'business owner'):
            author_type = 'business owner'
        elif author_type == 'customer':
            author_type = 'customer'
        else:
            author_type = None

        resolved_type = None
        try:
            # Try ?email= first, then ?id= as a fallback
            resp = requests.get(f"{user_profile_url}?email={user_email}", timeout=5)
            if resp.status_code != 200:
                resp = requests.get(f"{user_profile_url}?id={user_email}", timeout=5)

            if resp.status_code == 200:
                data = resp.json()
                resolved_type = (data.get('user', {}) or {}).get('type', '')
            else:
                logging.warning(f"User profile lookup non-200 ({resp.status_code}) for {user_email}")
        except Exception as e:
            logging.warning(f"Profile lookup failed (non-fatal): {e}")

        if resolved_type:
            author_type = 'business owner' if resolved_type.lower() == 'business' else 'customer'
        elif not author_type:
            author_type = 'customer'  # final fallback
        # --- end robust block ---

        # Get forum container with robust error handling
        try:
            container = get_container("forum")
            logging.info("Successfully connected to forum container for creation")
        except Exception as db_error:
            logging.error(f"Failed to connect to forum container: {str(db_error)}")
            # Try alternative approach
            try:
                from db_helpers import get_marketplace_db_client
                from azure.cosmos import PartitionKey

                database = get_marketplace_db_client()

                # Try to get existing container or create it
                try:
                    container = database.get_container_client("forum")
                    container.read()  # Test access
                except Exception:
                    # Create the forum container
                    container = database.create_container(
                        id="forum",
                        partition_key=PartitionKey(path="/category"),
                        offer_throughput=400
                    )
                    logging.info("Created new forum container for topic creation")

            except Exception as fallback_error:
                logging.error(f"Failed to create/access forum container: {str(fallback_error)}")
                return func.HttpResponse(
                    json.dumps({"error": f"Database connection failed: {str(fallback_error)}"}),
                    status_code=500,
                    mimetype="application/json"
                )

        # Create topic document
        topic_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        topic = {
            "id": topic_id,
            "type": "topic",
            "title": req_body['title'].strip(),
            "content": req_body['content'].strip(),
            "author": req_body['author'],
            "category": req_body['category'],
            "tags": req_body.get('tags', []),
            "images": req_body.get('images', []),
            "timestamp": timestamp,
            "lastActivity": timestamp,
            "replies": 0,
            "views": 0,
            "votes": 0,
            "isAnswered": False,
            "isPinned": False,
            "isClosed": False,
            "authorType": author_type,  # set from profile or fallback logic
            "hasImages": bool(req_body.get('images', []))
        }

        logging.info(f"Created topic object: {json.dumps(topic, indent=2)}")

        # Save to database with category as partition key
        try:
            created_item = container.create_item(body=topic)
            logging.info(f"Successfully created forum topic in database: {topic_id}")
        except Exception as create_error:
            logging.error(f"Failed to create topic in database: {str(create_error)}")
            return func.HttpResponse(
                json.dumps({"error": f"Failed to save topic to database: {str(create_error)}"}),
                status_code=500,
                mimetype="application/json"
            )

        logging.info(
            f"Created forum topic: {topic_id} in category: {req_body['category']} "
            f"with {len(req_body.get('images', []))} images"
        )

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


def handle_delete_topic(req: func.HttpRequest) -> func.HttpResponse:
    """Delete a forum topic by topicId"""
    try:
        topic_id = req.params.get('topicId')
        if not topic_id:
            return func.HttpResponse(
                json.dumps({"error": "Missing topicId parameter"}),
                status_code=400,
                mimetype="application/json"
            )
        container = get_container("forum")
        # Find the topic (need partition key: category)
        query = "SELECT * FROM c WHERE c.type = 'topic' AND c.id = @id"
        items = list(container.query_items(
            query=query,
            parameters=[{"name": "@id", "value": topic_id}],
            enable_cross_partition_query=True
        ))
        if not items:
            return func.HttpResponse(
                json.dumps({"error": "Topic not found"}),
                status_code=404,
                mimetype="application/json"
            )
        topic = items[0]
        # Delete the topic using id and partition key (category)
        container.delete_item(item=topic_id, partition_key=topic["category"])
        return func.HttpResponse(
            json.dumps({"success": True, "message": "Topic deleted"}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": f"Failed to delete topic: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )


def handle_edit_topic(req: func.HttpRequest) -> func.HttpResponse:
    """Edit a forum topic by topicId"""
    try:
        topic_id = req.params.get('topicId')
        if not topic_id:
            return func.HttpResponse(
                json.dumps({"error": "Missing topicId parameter"}),
                status_code=400,
                mimetype="application/json"
            )
        req_body = req.get_json()
        if not req_body:
            return func.HttpResponse(
                json.dumps({"error": "Missing request body"}),
                status_code=400,
                mimetype="application/json"
            )
        container = get_container("forum")
        # Find the topic
        query = "SELECT * FROM c WHERE c.type = 'topic' AND c.id = @id"
        items = list(container.query_items(
            query=query,
            parameters=[{"name": "@id", "value": topic_id}],
            enable_cross_partition_query=True
        ))
        if not items:
            return func.HttpResponse(
                json.dumps({"error": "Topic not found"}),
                status_code=404,
                mimetype="application/json"
            )
        topic = items[0]
        # Update fields if present in request
        for field in ["title", "content", "category", "tags", "images", "isAnswered", "isPinned", "isClosed"]:
            if field in req_body:
                topic[field] = req_body[field]
        topic["lastActivity"] = datetime.now(timezone.utc).isoformat()
        container.replace_item(item=topic_id, body=topic)
        return func.HttpResponse(
            json.dumps({"success": True, "message": "Topic updated", "topic": topic}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": f"Failed to edit topic: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

