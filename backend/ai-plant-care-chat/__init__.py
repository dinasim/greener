import azure.functions as func
import logging
import json
import os
import requests

import uuid
from datetime import datetime
from typing import Dict, List, Any
from azure.cosmos import CosmosClient, exceptions

# Use the same Gemini API key that's already working in your disease checker
GEMINI_API_KEY = "AIzaSyDaj4uxYtaVndDVu6YTIeZpbL8yZiF8mgk"

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('AI Plant Care Chat function processed a request.')

    try:
        # Get request data
        req_body = req.get_json()
        if not req_body:
            return func.HttpResponse(
                json.dumps({"error": "Request body is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )

        message = req_body.get('message', '').strip()
        context = req_body.get('context', [])
        session_id = req_body.get('sessionId', 'default')
        specialization = req_body.get('specialization', 'plant_care')

        if not message:
            return func.HttpResponse(
                json.dumps({"error": "Message is required"}),
                status_code=400,
                headers={"Content-Type": "application/json"}
            )

        # Try to get API key from environment variables first, then fallback to hardcoded key
        gemini_api_key = os.environ.get('GEMINI_API_KEY', GEMINI_API_KEY)
        
        if not gemini_api_key:
            logging.error("GEMINI_API_KEY not found")
            return func.HttpResponse(
                json.dumps({"error": "AI service temporarily unavailable"}),
                status_code=500,
                headers={"Content-Type": "application/json"}
            )

        # Generate AI response using Gemini
        ai_response = generate_gemini_response(
            message, context, session_id, specialization, gemini_api_key
        )
        
        # Store the message and response in Cosmos DB
        try:
            store_chat_history(message, ai_response, session_id)
            logging.info(f"Chat history saved to Cosmos DB for session: {session_id}")
        except Exception as e:
            logging.error(f"Error storing chat history in Cosmos DB: {str(e)}")
            # Continue even if storage fails - we don't want to block the user response

        # Log the successful response
        logging.info(f"Successful AI response generated. Session ID: {session_id}")
        
        # Add CORS headers to ensure frontend can receive the response
        return func.HttpResponse(
            json.dumps(ai_response),
            status_code=200,
            headers={
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        )

    except ValueError as e:
        logging.error(f"Invalid JSON in request body: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "error": "Invalid JSON format",
                "response": "I'm having trouble understanding your request format. Please try again."
            }),
            status_code=400,
            headers={"Content-Type": "application/json"}
        )
    except Exception as e:
        logging.error(f"Error processing request: {str(e)}")
        return func.HttpResponse(
            json.dumps({
                "error": "Internal server error",
                "response": "I apologize, but I'm experiencing technical difficulties. Please try again in a moment."
            }),
            status_code=500,
            headers={"Content-Type": "application/json"}
        )


def get_cosmos_client():
    """Get a Cosmos DB client using the marketplace connection string"""
    try:
        connection_string = os.environ.get('COSMOSDB__MARKETPLACE_CONNECTION_STRING')
        if not connection_string:
            logging.error("COSMOSDB__MARKETPLACE_CONNECTION_STRING not found in environment variables")
            return None
        
        return CosmosClient.from_connection_string(connection_string)
    except Exception as e:
        logging.error(f"Error creating Cosmos DB client: {str(e)}")
        return None


def store_chat_history(user_message: str, ai_response: Dict[str, Any], session_id: str):
    """Store chat history in Cosmos DB plant-care-chat container"""
    try:
        client = get_cosmos_client()
        if not client:
            logging.error("Failed to create Cosmos DB client, can't store chat history")
            return
        
        # Get database and container
        database_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
        container_name = "plant-care-chat"
        
        database = client.get_database_client(database_name)
        container = database.get_container_client(container_name)
        
        # Create document for user message
        timestamp = datetime.utcnow().isoformat()
        
        # User message document
        user_message_doc = {
            'id': f"msg_{uuid.uuid4()}",
            'sessionId': session_id,
            'messageType': 'user_message',
            'message': user_message,
            'timestamp': timestamp
        }
        
        # AI response document
        ai_response_doc = {
            'id': f"msg_{uuid.uuid4()}",
            'sessionId': session_id,
            'messageType': 'ai_response',
            'message': ai_response.get('response', ''),
            'confidence': ai_response.get('confidence', 0),
            'sources': ai_response.get('sources', []),
            'timestamp': timestamp
        }
        
        # Store both documents
        container.create_item(body=user_message_doc)
        container.create_item(body=ai_response_doc)
        
        logging.info(f"Chat history stored in Cosmos DB for session: {session_id}")
        
    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error storing chat history: {str(e)}")
    except Exception as e:
        logging.error(f"Unexpected error storing chat history: {str(e)}")


def get_chat_history(session_id: str, message_limit: int = 10) -> List[Dict]:
    """Retrieve chat history from Cosmos DB for a specific session"""
    try:
        client = get_cosmos_client()
        if not client:
            logging.error("Failed to create Cosmos DB client, can't retrieve chat history")
            return []
        
        # Get database and container
        database_name = os.environ.get('COSMOSDB_MARKETPLACE_DATABASE_NAME', 'greener-marketplace-db')
        container_name = "plant-care-chat"
        
        database = client.get_database_client(database_name)
        container = database.get_container_client(container_name)
        
        # Query for messages from this session, ordered by timestamp
        query = f"SELECT * FROM c WHERE c.sessionId = '{session_id}' ORDER BY c.timestamp DESC OFFSET 0 LIMIT {message_limit}"
        items = list(container.query_items(query=query, enable_cross_partition_query=True))
        
        # Reverse to get chronological order (oldest first)
        items.reverse()
        
        return items
        
    except exceptions.CosmosHttpResponseError as e:
        logging.error(f"Cosmos DB error retrieving chat history: {str(e)}")
        return []
    except Exception as e:
        logging.error(f"Unexpected error retrieving chat history: {str(e)}")
        return []


def generate_gemini_response(
    message: str, 
    context: List[Dict], 
    session_id: str, 
    specialization: str, 
    api_key: str
) -> Dict[str, Any]:
    """Generate response using Google Gemini API"""
    
    try:
        # Try to retrieve additional context from Cosmos DB
        db_context = []
        try:
            db_history = get_chat_history(session_id)
            if db_history:
                # Convert DB history format to the context format expected by the function
                for item in db_history:
                    if item.get('messageType') == 'user_message':
                        db_context.append({
                            "role": "user",
                            "content": item.get('message', '')
                        })
                    elif item.get('messageType') == 'ai_response':
                        db_context.append({
                            "role": "assistant",
                            "content": item.get('message', '')
                        })
                
                logging.info(f"Retrieved {len(db_history)} messages from Cosmos DB for context")
        except Exception as e:
            logging.warning(f"Could not retrieve chat history from Cosmos DB: {str(e)}")
            # Continue with the provided context if DB retrieval fails
        
        # Merge context from request with context from DB, prioritizing the request context
        # if there's overlap
        if db_context and not context:
            context = db_context
        
        # Construct the system prompt for plant care specialization
        system_prompt = """You are an expert AI Plant Care Assistant with deep knowledge in:
- Houseplant care and maintenance
- Plant diseases and pest identification
- Watering, lighting, and fertilization schedules
- Plant propagation techniques
- Soil types and drainage requirements
- Indoor and outdoor gardening
- Plant identification and botanical knowledge
- Troubleshooting plant health issues

Guidelines for responses:
1. Provide accurate, actionable plant care advice
2. Be encouraging and supportive to plant enthusiasts
3. Ask clarifying questions when plant identification or specific conditions are unclear
4. Suggest preventive measures for plant health
5. Use emojis sparingly but appropriately (🌿🌱💧☀️)
6. Keep responses concise but comprehensive
7. Always prioritize plant safety and health
8. If you're unsure about plant identification, ask for more details or photos

Format your responses to be helpful, friendly, and expert-level."""

        # Prepare the conversation history
        conversation_history = []
        
        # Add system message
        conversation_history.append({
            "role": "user",
            "parts": [{"text": system_prompt}]
        })
        conversation_history.append({
            "role": "model",
            "parts": [{"text": "Hello! I'm your AI Plant Care Assistant. I'm here to help you with all your plant care questions and concerns. What would you like to know about plant care today?"}]
        })

        # Add context from previous messages
        for msg in context[-8:]:  # Use last 8 messages for context
            role = "user" if msg["role"] == "user" else "model"
            conversation_history.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })

        # Add current message
        conversation_history.append({
            "role": "user",
            "parts": [{"text": message}]
        })

        # Log request payload for debugging
        logging.info(f"Sending request to Gemini API for session: {session_id}")
        
        # Prepare request to Gemini API
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        payload = {
            "contents": conversation_history,
            "generationConfig": {
                "temperature": 0.7,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 1024,
                "stopSequences": []
            },
            "safetySettings": [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        }

        headers = {
            "Content-Type": "application/json"
        }

        # Make request to Gemini API
        response = requests.post(gemini_url, headers=headers, json=payload, timeout=30)
        
        # Log API response status for debugging
        logging.info(f"Gemini API response status: {response.status_code}")
        
        if response.status_code != 200:
            logging.error(f"Gemini API error: {response.status_code} - {response.text}")
            return {
                "response": "I apologize, but I'm having trouble accessing my knowledge base right now. Please try again in a moment.",
                "confidence": 0.0,
                "sources": [],
                "error": f"API_ERROR_{response.status_code}"
            }

        result = response.json()
        
        # Extract the response text
        if "candidates" in result and len(result["candidates"]) > 0:
            candidate = result["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"]:
                response_text = candidate["content"]["parts"][0]["text"]
                
                # Calculate a simple confidence score based on response length and structure
                confidence = calculate_confidence_score(response_text, message)
                
                logging.info(f"Successfully generated response with confidence: {confidence}")
                
                return {
                    "response": response_text.strip(),
                    "confidence": confidence,
                    "sources": ["Gemini AI - Plant Care Knowledge Base"],
                    "session_id": session_id
                }
            else:
                logging.error("Unexpected response structure - missing content or parts")
                logging.error(f"Response structure: {json.dumps(candidate)}")
        else:
            logging.error("No candidates in API response")
            logging.error(f"Response structure: {json.dumps(result)}")
        
        # Fallback response when parsing fails
        return {
            "response": "I understand you're asking about plant care, but I need a bit more information to provide the best advice. Could you please provide more details about your specific situation?",
            "confidence": 0.3,
            "sources": [],
            "session_id": session_id,
            "error": "RESPONSE_PARSE_ERROR"
        }

    except requests.exceptions.Timeout:
        logging.error("Gemini API request timed out")
        return {
            "response": "I'm taking a bit longer to think about your question. Please try asking again.",
            "confidence": 0.0,
            "sources": [],
            "error": "TIMEOUT"
        }
    
    except requests.exceptions.RequestException as e:
        logging.error(f"Request error: {str(e)}")
        return {
            "response": "I'm having trouble connecting to my knowledge base. Please check your internet connection and try again.",
            "confidence": 0.0,
            "sources": [],
            "error": "CONNECTION_ERROR"
        }
    
    except Exception as e:
        logging.error(f"Unexpected error in generate_gemini_response: {str(e)}")
        logging.exception("Detailed exception info:")  # This will log the full stack trace
        return {
            "response": "I encountered an unexpected error. Please try rephrasing your question.",
            "confidence": 0.0,
            "sources": [],
            "error": "UNEXPECTED_ERROR"
        }


def calculate_confidence_score(response_text: str, original_question: str) -> float:
    """Calculate a confidence score based on response quality indicators"""
    
    try:
        score = 0.5  # Base score
        
        # Length indicators
        if len(response_text) > 50:
            score += 0.1
        if len(response_text) > 150:
            score += 0.1
        
        # Plant-related keywords
        plant_keywords = [
            'plant', 'water', 'soil', 'light', 'fertilizer', 'growth', 
            'leaves', 'roots', 'drainage', 'humidity', 'temperature',
            'disease', 'pest', 'care', 'maintenance', 'propagation'
        ]
        
        response_lower = response_text.lower()
        keyword_matches = sum(1 for keyword in plant_keywords if keyword in response_lower)
        score += min(keyword_matches * 0.05, 0.2)
        
        # Structure indicators (lists, specific advice)
        if '•' in response_text or '-' in response_text:
            score += 0.1
        
        # Question relevance
        question_lower = original_question.lower()
        question_words = set(question_lower.split())
        response_words = set(response_lower.split())
        overlap = len(question_words.intersection(response_words))
        if overlap > 2:
            score += 0.1
        
        # Cap at 0.95 (never 100% confident)
        return min(score, 0.95)
    
    except Exception as e:
        logging.error(f"Error calculating confidence score: {str(e)}")
        return 0.5  # Default confidence if calculation fails