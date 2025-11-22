from openai import OpenAI
import os
from dotenv import load_dotenv
from .prompt_service import MedicalPromptEngine
from .conversation_service import ConversationService
from ..models.chat import ConversationHistory, Message
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
logger.info(f"OpenAI API key available: {bool(api_key)}")
if not api_key:
    logger.error("OPENAI_API_KEY not found in environment variables")
    raise ValueError("OPENAI_API_KEY is required but not found")

client = OpenAI(api_key=api_key)
prompt_engine = MedicalPromptEngine()
conversation_service = ConversationService()

async def get_ai_response(message: str, email: str) -> str:
    """Get AI response with optimized conversation management and no redundancy."""
    logger.info(f"Getting AI response for email: {email}")
    logger.info(f"Message received: {message}")
    
    # Get conversation context once (optimized)
    conversation_history = conversation_service.get_context(email)
    logger.info(f"Conversation history: {conversation_history}")
    
    # Check if health-related using AI with conversation context
    is_health = prompt_engine.is_health_related(message, conversation_history)
    logger.info(f"Message health-related check: {is_health} for message: {message}")
    
    if not is_health:
        logger.info(f"Message not health-related: {message}")
        non_health_response = "I'm a medical assistant focused on health concerns. Please let me know if you have any medical questions or symptoms you'd like to discuss."
        # Store conversation turn atomically (no redundancy)
        conversation_service.add_conversation_turn(email, message, non_health_response)
        return non_health_response

    # Create context-aware prompt
    prompt = prompt_engine.create_context_aware_prompt(message, conversation_history)
    logger.info(f"Generated prompt: {prompt[:100]}...")
    
    # Create message list with context
    messages = [
        {"role": "system", "content": prompt_engine.system_context},
        *conversation_history,
        {"role": "user", "content": message}
    ]
    
    logger.info(f"Final messages for OpenAI: {messages}")
    
    try:
        logger.info(f"Calling OpenAI API with {len(messages)} messages")
        
        # Get response from OpenAI using GPT-4.1
        response = client.chat.completions.create(
            model="gpt-4-1106-preview",
            messages=messages,
            temperature=0.3,
            max_tokens=500,
            top_p=0.9,
            frequency_penalty=0.3,
            presence_penalty=0.3,
            response_format={"type": "text"},
            seed=42
        )
        
        logger.info(f"OpenAI API response received: {response}")
        
        # Extract and process response
        if not response.choices or len(response.choices) == 0:
            logger.error("No choices in OpenAI response")
            raise Exception("No response choices from OpenAI")
        
        ai_response = response.choices[0].message.content
        logger.info(f"Extracted AI response: {ai_response}")
        
        if not ai_response:
            logger.error("Empty AI response")
            raise Exception("Empty response from OpenAI")
        
        # Store conversation turn atomically (no redundancy)
        conversation_service.add_conversation_turn(email, message, ai_response)
        
        # Add disclaimer if needed
        final_response = prompt_engine.add_medical_disclaimer(ai_response)
        logger.info(f"Final response: {final_response}")
        return final_response
        
    except Exception as e:
        logger.error(f"Error getting AI response: {str(e)}")
        # Fallback to GPT-3.5 if GPT-4.1 fails
        try:
            logger.info("Trying GPT-3.5 fallback...")
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.3,
                max_tokens=100
            )
            logger.info(f"GPT-3.5 response: {response}")
            
            if not response.choices or len(response.choices) == 0:
                logger.error("No choices in GPT-3.5 response")
                raise Exception("No response choices from GPT-3.5")
            
            ai_response = response.choices[0].message.content
            logger.info(f"GPT-3.5 AI response: {ai_response}")
            
            if not ai_response:
                logger.error("Empty GPT-3.5 response")
                raise Exception("Empty response from GPT-3.5")
            
            # Store conversation turn atomically (no redundancy)
            conversation_service.add_conversation_turn(email, message, ai_response)
            return prompt_engine.add_medical_disclaimer(ai_response)
        except Exception as fallback_error:
            logger.error(f"Fallback error: {str(fallback_error)}")
            # Return a simple response if all AI calls fail
            return "I understand you said: " + message + ". How can I help you with your health concerns?"
