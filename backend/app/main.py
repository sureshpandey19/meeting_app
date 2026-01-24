import os
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from . import auth, models, schemas
from .db import Base, engine, get_db

load_dotenv()

app = FastAPI(title="Meeting API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

Base.metadata.create_all(bind=engine)


@app.post("/api/meetings", response_model=schemas.MeetingCreateResponse)
def create_meeting(payload: schemas.MeetingCreate, db: Session = Depends(get_db)):
    hashed = auth.hash_password(payload.password)
    meeting = models.Meeting(
        title=payload.title,
        password_hash=hashed,
        created_by=payload.created_by
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    join_link = f"/join?meetingId={meeting.id}"
    return schemas.MeetingCreateResponse(meeting_id=meeting.id, join_link=join_link)


@app.post("/api/meetings/{meeting_id}/join", response_model=schemas.MeetingJoinResponse)
def join_meeting(meeting_id: str, payload: schemas.MeetingJoin, db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting or meeting.status != "active":
        raise HTTPException(status_code=404, detail="Meeting not found")

    if not auth.verify_password(payload.password, meeting.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    participant = models.Participant(
        meeting_id=meeting.id,
        display_name=payload.display_name
    )
    db.add(participant)
    db.commit()

    token = auth.create_access_token(subject=f"meeting:{meeting.id}")
    return schemas.MeetingJoinResponse(meeting_id=meeting.id, access_token=token)


@app.get("/api/meetings/{meeting_id}", response_model=schemas.MeetingInfo)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return schemas.MeetingInfo(
        meeting_id=meeting.id,
        title=meeting.title,
        status=meeting.status
    )
