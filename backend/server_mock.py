from fastapi import FastAPI, APIRouter, HTTPException, File, UploadFile, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import secrets
import base64
from io import BytesIO
from PIL import Image

# Mock classes for Gemini integration
class ImageContent:
    def __init__(self, image_base64: str):
        self.image_base64 = image_base64

class UserMessage:
    def __init__(self, content: str, image_content: ImageContent = None):
        self.content = content
        self.image_content = image_content

class LlmChat:
    def __init__(self, api_key: str, session_id: str, system_message: str):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
    
    def with_model(self, provider: str, model: str):
        return self
    
    async def send_message(self, message: UserMessage) -> str:
        # Mock response for testing
        return "Mock alt-text: A descriptive image showing various elements that would be described by AI in a real implementation."

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection - using mock values for testing
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'alttext_test')

try:
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
except:
    # Mock database for testing
    db = None

# Create the main app without a prefix
app = FastAPI(title="Alt-Text AI SaaS", description="AI-powered alt-text generation for WordPress")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    api_token: str
    subscription_plan: str = "free_trial"  # free_trial, starter, pro, pay_as_go
    credits_remaining: int = 30
    total_processed: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None

class UserCreate(BaseModel):
    email: str
    subscription_plan: str = "free_trial"

class AltTextRequest(BaseModel):
    image_base64: str
    context: Optional[str] = None

class AltTextResponse(BaseModel):
    alt_text: str
    credits_remaining: int

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock user storage for testing
users_db = {}

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current user from API token"""
    token = credentials.credentials
    
    # Mock user lookup
    for user in users_db.values():
        if user.api_token == token:
            return user
    
    raise HTTPException(status_code=401, detail="Invalid API token")

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    """Create a new user"""
    # Check if user already exists
    for user in users_db.values():
        if user.email == user_data.email:
            raise HTTPException(status_code=400, detail="User already exists")
    
    # Create new user
    user = User(
        email=user_data.email,
        api_token=secrets.token_urlsafe(32),
        subscription_plan=user_data.subscription_plan
    )
    
    users_db[user.id] = user
    return user

@api_router.get("/users/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@api_router.post("/generate-alt-text", response_model=AltTextResponse)
async def generate_alt_text(
    request: AltTextRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate alt-text for an image"""
    
    # Check credits
    if current_user.credits_remaining <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credits")
    
    try:
        # Generate alt-text using mock Gemini
        alt_text = await generate_alt_text_with_gemini(request.image_base64, request.context)
        
        # Update user credits
        current_user.credits_remaining -= 1
        current_user.total_processed += 1
        users_db[current_user.id] = current_user
        
        return AltTextResponse(
            alt_text=alt_text,
            credits_remaining=current_user.credits_remaining
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating alt-text: {str(e)}")

async def generate_alt_text_with_gemini(image_base64: str, context: str = None) -> str:
    """Generate alt-text using Gemini AI (mock implementation)"""
    try:
        # Initialize Gemini chat
        chat = LlmChat(
            api_key=os.environ.get('GEMINI_API_KEY', 'mock_key'),
            session_id=f"alttext_{uuid.uuid4()}",
            system_message="You are an expert at creating SEO-friendly, descriptive alt-text for images. Generate concise, descriptive alt-text that helps visually impaired users understand the image content while being SEO-optimized."
        ).with_model("gemini", "gemini-2.0-flash")

        # Create image content
        image_content = ImageContent(image_base64=image_base64)
        
        # Create prompt
        prompt = "Generate a concise, SEO-friendly alt-text for this image. Focus on the main subject, actions, and important visual elements. Keep it under 125 characters."
        if context:
            prompt += f" Context: {context}"
        
        # Create message
        message = UserMessage(content=prompt, image_content=image_content)
        
        # Send message and get response
        response = await chat.send_message(message)
        
        return response.strip()
    
    except Exception as e:
        logging.error(f"Error in generate_alt_text_with_gemini: {e}")
        return "Error generating alt-text"

# Health check endpoint
@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Alt-Text AI API is running"}

# Include the API router
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
