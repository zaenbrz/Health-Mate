from typing import List, Dict

class MedicalPromptEngine:
    def __init__(self):
        self.system_context = """You are a MEDICAL TRIAGE ASSISTANT AI. Your goal is to efficiently gather symptoms and provide a likely assessment.

LANGUAGE & TONE:
- **Bilingual**: Detect the user's language (English or Urdu) and respond in the EXACT SAME language.
- **Concise**: Keep responses short (1-2 sentences).
- **One Question Rule**: Ask ONLY ONE follow-up question at a time. Never ask multiple questions in a single turn.

TRIAGE PROTOCOL:
1.  **Gather Info**: If the user's condition is unclear, ask a specific question to narrow down possibilities (use OPQRST: Onset, Provocation, Quality, Region, Severity, Time).
2.  **Red Flags**: If you detect emergency symptoms (chest pain, difficulty breathing, severe bleeding), STOP questioning and advise immediate emergency care.
3.  **Formulate Hypothesis**: As you gather info, build a list of potential conditions.
4.  **Assessment**: Once you have enough information (usually after 3-4 questions) or feel somewhat confident, provide:
    *   **Likely Cause**: What might be happening.
    *   **Recommendations**: Home care or lifestyle advice.
    *   **Next Step**: Whether to see a GP, specialist, or go to ER.

EMPATHY:
- Briefly validate distress ("I understand that sounds painful") before asking your ONE question."""

        

    def is_health_related(self, message: str, conversation_history: list = None) -> bool:
        """
        Intelligent health-related detection using OpenAI's natural language understanding.
        This leverages the AI model's capability to understand context and medical relevance
        without needing to maintain exhaustive keyword lists.
        """
        try:
            from openai import OpenAI
            import os
            from dotenv import load_dotenv
            
            load_dotenv()
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
            # Build context from conversation history if available
            context_info = ""
            if conversation_history and len(conversation_history) > 0:
                recent_messages = [msg.get('content', '') for msg in conversation_history[-3:] 
                                 if msg.get('role') == 'user']
                if recent_messages:
                    context_info = f"\nRecent conversation context: {' | '.join(recent_messages)}"
            
            # Create a strict prompt for health relevance detection
            health_detection_prompt = f"""You are a medical triage assistant. Determine if the following message is DIRECTLY related to health, medical concerns, symptoms, injuries, or wellness.

Message: "{message}"{context_info}

STRICT RULES:
- Only classify as HEALTH if the message itself contains health/medical content
- Do NOT classify as HEALTH just because of previous medical conversation context
- The message must be asking about health, describing symptoms, or requesting medical advice
- General statements, greetings, or unrelated topics should be NOT_HEALTH

Examples:
✅ HEALTH:
- "My cut is getting worse"
- "I feel dizzy" 
- "Should I see a doctor?"
- "How do I treat this wound?"

❌ NOT_HEALTH:
- "I have a present to give" (even if discussing injury before)
- "I'll warn you" (even in medical context)
- "What's the weather?"
- "How are you?"
- "Thank you"

Respond with ONLY: "HEALTH" or "NOT_HEALTH"

Response:"""

            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": health_detection_prompt}],
                max_tokens=10,
                temperature=0.0
            )
            
            result = response.choices[0].message.content.strip().upper()
            return "HEALTH" in result
            
        except Exception as e:
            # Fallback to strict keyword detection if OpenAI fails
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"OpenAI health detection failed: {e}, using strict fallback")
            
            # Strict fallback - only clear medical terms
            direct_health_indicators = [
                'pain', 'hurt', 'ache', 'sick', 'ill', 'fever', 'cough', 'headache',
                'cut', 'wound', 'injury', 'bleeding', 'bleed', 'bruise', 'burn',
                'doctor', 'hospital', 'medicine', 'medication', 'treatment',
                'symptom', 'symptoms', 'feel sick', 'feel ill', 'not feeling well',
                'health problem', 'medical help', 'see a doctor', 'emergency'
            ]
            
            # Only return True if message contains clear health indicators
            message_lower = message.lower()
            return any(indicator in message_lower for indicator in direct_health_indicators)

    def create_response_prompt(self, message: str) -> str:
        """Create appropriate prompt based on message content for medical triage."""
        if not self.is_health_related(message):
            return "I'm your medical triage assistant. How can I help with your health concerns today?"
        
        # FE-2: Symptom assessment (Expanded keywords)
        if any(keyword in message.lower() for keyword in ['symptom', 'feel', 'pain', 'hurt', 'ache', 'swollen', 'dizzy', 'nausea', 'bleeding', 'rash']):
            return f"User is reporting symptoms: {message}. Start or continue the triage process. Ask ONE specific follow-up question using OPQRST to narrow down the cause. Do not give a diagnosis yet unless you have full context."
        
        # Mental Health Support
        elif any(keyword in message.lower() for keyword in ['sad', 'anxious', 'depressed', 'stress', 'panic', 'worry', 'tired', 'lonely', 'mood']):
            return f"User is expressing mental distress: {message}. Validate their feelings warmly. Ask ONE gentle follow-up question to understand the severity or duration."

        # FE-3: Lifestyle recommendations
        elif any(keyword in message.lower() for keyword in ['lifestyle', 'diet', 'food', 'eat', 'exercise', 'workout', 'sleep', 'habit']):
            return f"Provide brief, actionable lifestyle advice for: {message}. Limit to 2-3 key tips."
        
        # FE-4: Specialist consultation guidance
        elif any(keyword in message.lower() for keyword in ['specialist', 'doctor', 'hospital', 'clinic', 'appointment']):
            return f"Guide the user on which specialist to see for: {message}. Be direct and concise."
        
        # General health concerns
        else:
            return f"Triage this health concern: {message}. If vague, ask ONE clarifying question. If clear, provide an assessment and next steps."

    def create_context_aware_prompt(self, message: str, conversation_history: List[Dict]) -> str:
        """FE-1: Create context-aware prompts for multi-turn conversations."""
        if not conversation_history:
            return self.create_response_prompt(message)
        
        # Build context from conversation history
        context_summary = self._build_context_summary(conversation_history)
        
        # Create context-aware prompt for AI processing
        return f"""Based on our previous conversation about: {context_summary}
        
Current message: {message}

Maintain context and provide coherent medical triage guidance. If this is a follow-up to previous symptoms, reference them appropriately."""

    def _build_context_summary(self, conversation_history: List[Dict]) -> str:
        """Build a summary of conversation context."""
        recent_topics = []
        for msg in conversation_history[-6:]:  # Last 3 messages for context
            if msg.get('role') == 'user':
                recent_topics.append(msg.get('content', ''))
        
        return " | ".join(recent_topics) if recent_topics else "No previous context"

    def add_medical_disclaimer(self, response: str) -> str:
        """Add medical disclaimer only for responses containing specific medical advice."""
        # Keywords that indicate medical advice requiring disclaimer
        medical_advice_keywords = {
            'take', 'use', 'apply', 'prescribe', 'recommend', 'suggest',
            'medication', 'medicine', 'drug', 'treatment', 'therapy',
            'dosage', 'dose', 'side effects', 'contraindications'
        }
        
        # Check if response contains medical advice
        if any(keyword in response.lower() for keyword in medical_advice_keywords):
            return f"{response}\nNote: Seek a physical medical consultation if your condition feels urgent."
        
        return response 