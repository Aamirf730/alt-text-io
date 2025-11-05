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

# Emergent integrations for Gemini
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

class UserLogin(BaseModel):
    email: str

class AltTextRequest(BaseModel):
    image_base64: str
    context: Optional[str] = None

class AltTextResponse(BaseModel):
    alt_text: str
    credits_used: int
    credits_remaining: int

class UsageStats(BaseModel):
    current_plan: str
    credits_remaining: int
    total_processed: int
    plan_expires: Optional[datetime]

class SubscriptionUpdate(BaseModel):
    plan: str  # starter, pro, pay_as_go

# Subscription plans configuration
SUBSCRIPTION_PLANS = {
    "free_trial": {"credits": 30, "price": 0, "duration_days": None},
    "starter": {"credits": 500, "price": 5, "duration_days": 30},
    "pro": {"credits": 2000, "price": 10, "duration_days": 30},
    "pay_as_go": {"credits": 50, "price": 3, "duration_days": None}
}

# Helper functions
def generate_api_token():
    return f"altai_{secrets.token_urlsafe(32)}"

async def get_user_by_token(token: str):
    user = await db.users.find_one({"api_token": token})
    if user:
        return User(**user)
    return None

async def verify_api_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    user = await get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API token")
    
    # Check if subscription is expired
    if user.expires_at and user.expires_at < datetime.now(timezone.utc):
        # Reset to free trial if expired
        await db.users.update_one(
            {"id": user.id},
            {"$set": {
                "subscription_plan": "free_trial",
                "credits_remaining": 30,
                "expires_at": None
            }}
        )
        user.subscription_plan = "free_trial"
        user.credits_remaining = 30
        user.expires_at = None
    
    return user

async def generate_alt_text_with_gemini(image_base64: str, context: str = None) -> str:
    try:
        # Initialize Gemini chat
        chat = LlmChat(
            api_key=os.environ.get('GEMINI_API_KEY'),
            session_id=f"alttext_{uuid.uuid4()}",
            system_message="You are an expert at creating SEO-friendly, descriptive alt-text for images. Generate concise, descriptive alt-text that helps visually impaired users understand the image content while being SEO-optimized."
        ).with_model("gemini", "gemini-1.5-flash")

        # Create image content
        image_content = ImageContent(image_base64=image_base64)
        
        # Create prompt
        prompt = "Generate a concise, SEO-friendly alt-text for this image. Focus on the main subject, actions, and important visual elements. Keep it under 125 characters."
        if context:
            prompt += f" Context: {context}"

        # Create message with image
        user_message = UserMessage(
            text=prompt,
            file_contents=[image_content]
        )

        # Get response
        response = await chat.send_message(user_message)
        
        # Clean up the response
        alt_text = response.strip().replace('"', '').replace("Alt-text:", "").strip()
        
        return alt_text[:125] if len(alt_text) > 125 else alt_text
        
    except Exception as e:
        logging.error(f"Error generating alt-text with Gemini: {str(e)}")
        return "Image description unavailable"

# Auth endpoints
@api_router.post("/auth/register")
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        return {"api_token": existing_user["api_token"], "message": "User already exists"}
    
    # Create new user
    api_token = generate_api_token()
    user = User(
        email=user_data.email,
        api_token=api_token,
        subscription_plan="free_trial",
        credits_remaining=30
    )
    
    await db.users.insert_one(user.dict())
    return {"api_token": api_token, "message": "User registered successfully"}

@api_router.post("/auth/login")
async def login_user(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"api_token": user["api_token"], "message": "Login successful"}

# Core API endpoints for WordPress plugin
@api_router.post("/generate", response_model=AltTextResponse)
async def generate_alt_text(
    request: AltTextRequest,
    current_user: User = Depends(verify_api_token)
):
    # Check if user has credits
    if current_user.credits_remaining <= 0:
        raise HTTPException(status_code=402, detail="No credits remaining. Please upgrade your plan.")
    
    try:
        # Generate alt-text using Gemini
        alt_text = await generate_alt_text_with_gemini(request.image_base64, request.context)
        
        # Update user credits and stats
        credits_used = 1
        new_credits = current_user.credits_remaining - credits_used
        new_total = current_user.total_processed + 1
        
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {
                "credits_remaining": new_credits,
                "total_processed": new_total
            }}
        )
        
        # Log usage
        await db.usage_logs.insert_one({
            "user_id": current_user.id,
            "credits_used": credits_used,
            "timestamp": datetime.now(timezone.utc),
            "alt_text_generated": alt_text
        })
        
        return AltTextResponse(
            alt_text=alt_text,
            credits_used=credits_used,
            credits_remaining=new_credits
        )
        
    except Exception as e:
        logging.error(f"Error in generate_alt_text: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate alt-text")

@api_router.get("/usage", response_model=UsageStats)
async def get_usage_stats(current_user: User = Depends(verify_api_token)):
    return UsageStats(
        current_plan=current_user.subscription_plan,
        credits_remaining=current_user.credits_remaining,
        total_processed=current_user.total_processed,
        plan_expires=current_user.expires_at
    )

@api_router.post("/auth/validate")
async def validate_token(current_user: User = Depends(verify_api_token)):
    return {
        "valid": True,
        "user_id": current_user.id,
        "email": current_user.email,
        "plan": current_user.subscription_plan,
        "credits_remaining": current_user.credits_remaining
    }

# Subscription management
@api_router.post("/subscription/update")
async def update_subscription(
    subscription: SubscriptionUpdate,
    current_user: User = Depends(verify_api_token)
):
    if subscription.plan not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid subscription plan")
    
    plan_config = SUBSCRIPTION_PLANS[subscription.plan]
    expires_at = None
    
    if plan_config["duration_days"]:
        expires_at = datetime.now(timezone.utc) + timedelta(days=plan_config["duration_days"])
    
    # Update user subscription
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "subscription_plan": subscription.plan,
            "credits_remaining": plan_config["credits"],
            "expires_at": expires_at
        }}
    )
    
    return {
        "message": f"Subscription updated to {subscription.plan}",
        "credits": plan_config["credits"],
        "expires_at": expires_at
    }

# Get subscription plans
@api_router.get("/plans")
async def get_subscription_plans():
    return {
        "plans": [
            {
                "id": "free_trial",
                "name": "Free Trial",
                "price": 0,
                "credits": 30,
                "billing_cycle": "one-time",
                "features": ["30 AI-generated alt-texts", "Basic support"]
            },
            {
                "id": "starter",
                "name": "Starter",
                "price": 5,
                "credits": 500,
                "billing_cycle": "monthly",
                "features": ["500 AI-generated alt-texts/month", "Priority support", "SEO optimization"]
            },
            {
                "id": "pro",
                "name": "Pro",
                "price": 10,
                "credits": 2000,
                "billing_cycle": "monthly",
                "features": ["2000 AI-generated alt-texts/month", "Premium support", "Bulk processing", "API access"]
            },
            {
                "id": "pay_as_go",
                "name": "Pay-as-you-go",
                "price": 3,
                "credits": 50,
                "billing_cycle": "credits",
                "features": ["50 AI-generated alt-texts", "No expiration", "Flexible usage"]
            }
        ]
    }

# Test endpoint
@api_router.get("/")
async def root():
    return {"message": "Alt-Text AI SaaS API is running"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
