import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from .db import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200), nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_by = Column(String(200), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    meeting_id = Column(String(36), nullable=False)
    display_name = Column(String(200), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
