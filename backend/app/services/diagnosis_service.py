"""
Diagnosis Service
Extracts medical insights and diagnosis from conversation history
"""
from typing import Dict, List, Optional
from datetime import datetime
import logging
from openai import OpenAI
import os
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

class DiagnosisService:
    """Service for extracting diagnosis and medical summaries from conversations"""
    
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    async def extract_diagnosis_from_conversations(self, user_email: str) -> Dict:
        """
        Analyze all conversation history and extract medical diagnosis/assessment
        Returns structured diagnosis information
        """
        try:
            from ..database import db
            
            # Get all conversations for the user
            conversation = db.conversations.find_one({"email": user_email})
            
            if not conversation or "messages" not in conversation:
                return {
                    "diagnosis_summary": "No medical conversations found",
                    "symptoms_discussed": [],
                    "conditions_mentioned": [],
                    "recommendations_given": [],
                    "specialist_referrals": []
                }
            
            # Extract all messages
            messages = conversation.get("messages", [])
            
            if len(messages) == 0:
                return {
                    "diagnosis_summary": "No medical conversations found",
                    "symptoms_discussed": [],
                    "conditions_mentioned": [],
                    "recommendations_given": [],
                    "specialist_referrals": []
                }
            
            # Build conversation text for analysis
            conversation_text = self._build_conversation_text(messages)
            
            # Use OpenAI to extract structured diagnosis
            diagnosis_data = await self._analyze_medical_conversation(conversation_text)
            
            return diagnosis_data
            
        except Exception as e:
            logger.error(f"Error extracting diagnosis: {str(e)}")
            return {
                "diagnosis_summary": "Error extracting diagnosis",
                "symptoms_discussed": [],
                "conditions_mentioned": [],
                "recommendations_given": [],
                "specialist_referrals": [],
                "error": str(e)
            }
    
    def _build_conversation_text(self, messages: List[Dict]) -> str:
        """Build formatted conversation text from messages"""
        conversation_lines = []
        
        for msg in messages:
            role = "Patient" if msg.get("role") == "user" else "AI Assistant"
            content = msg.get("content", "")
            timestamp = msg.get("timestamp", "")
            
            if timestamp:
                if isinstance(timestamp, str):
                    date_str = timestamp
                else:
                    date_str = timestamp.strftime("%Y-%m-%d %H:%M")
                conversation_lines.append(f"[{date_str}] {role}: {content}")
            else:
                conversation_lines.append(f"{role}: {content}")
        
        return "\n".join(conversation_lines)
    
    async def _analyze_medical_conversation(self, conversation_text: str) -> Dict:
        """Use OpenAI to extract structured diagnosis from conversation"""
        try:
            analysis_prompt = f"""You are a medical information extraction AI. Analyze the following medical triage conversation between a patient and an AI assistant.

Extract and summarize:
1. **Diagnosis Summary**: A 2-3 sentence summary of the patient's medical condition based on the conversation
2. **Symptoms Discussed**: List of all symptoms the patient mentioned
3. **Conditions Mentioned**: Any medical conditions, diseases, or diagnoses discussed
4. **Recommendations Given**: Medical advice, lifestyle changes, or treatments suggested
5. **Specialist Referrals**: Any specialists the patient was advised to consult

Conversation:
{conversation_text}

Provide your analysis in the following JSON format:
{{
  "diagnosis_summary": "Brief summary of patient's condition",
  "symptoms_discussed": ["symptom1", "symptom2"],
  "conditions_mentioned": ["condition1", "condition2"],
  "recommendations_given": ["recommendation1", "recommendation2"],
  "specialist_referrals": ["specialist1", "specialist2"]
}}

If no relevant information is found for a category, use an empty array [].
"""

            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a medical information extraction expert. Extract structured medical information from conversations and return valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": analysis_prompt
                    }
                ],
                temperature=0.3,
                max_tokens=800
            )
            
            # Parse the JSON response
            import json
            result_text = response.choices[0].message.content.strip()
            
            # Extract JSON from markdown code blocks if present
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            diagnosis_data = json.loads(result_text)
            
            logger.info("Successfully extracted diagnosis from conversation")
            return diagnosis_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse diagnosis JSON: {e}")
            return {
                "diagnosis_summary": "Unable to parse diagnosis information",
                "symptoms_discussed": [],
                "conditions_mentioned": [],
                "recommendations_given": [],
                "specialist_referrals": []
            }
        except Exception as e:
            logger.error(f"Error analyzing conversation: {str(e)}")
            return {
                "diagnosis_summary": f"Error analyzing conversation: {str(e)}",
                "symptoms_discussed": [],
                "conditions_mentioned": [],
                "recommendations_given": [],
                "specialist_referrals": []
            }
    
    async def get_diagnosis_for_report(self, user_email: str) -> str:
        """
        Get a formatted diagnosis summary for inclusion in medical reports
        """
        try:
            diagnosis_data = await self.extract_diagnosis_from_conversations(user_email)
            
            # Format as readable text
            summary = f"Medical Triage Summary:\n{diagnosis_data.get('diagnosis_summary', 'No diagnosis available')}\n"
            
            if diagnosis_data.get('symptoms_discussed'):
                summary += f"\nSymptoms: {', '.join(diagnosis_data['symptoms_discussed'])}"
            
            if diagnosis_data.get('conditions_mentioned'):
                summary += f"\nConditions: {', '.join(diagnosis_data['conditions_mentioned'])}"
            
            if diagnosis_data.get('recommendations_given'):
                summary += f"\nRecommendations: {', '.join(diagnosis_data['recommendations_given'])}"
            
            if diagnosis_data.get('specialist_referrals'):
                summary += f"\nSpecialist Referrals: {', '.join(diagnosis_data['specialist_referrals'])}"
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting diagnosis for report: {str(e)}")
            return "No diagnosis information available"
