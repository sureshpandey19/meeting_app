from typing import Optional
from pydantic import BaseModel, Field


class MeetingCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=4, max_length=64)
    created_by: Optional[str] = None


class MeetingCreateResponse(BaseModel):
    meeting_id: str
    join_link: str


class MeetingJoin(BaseModel):
    password: str = Field(min_length=4, max_length=64)
    display_name: str = Field(min_length=2, max_length=200)


class MeetingJoinResponse(BaseModel):
    meeting_id: str
    access_token: str


class MeetingInfo(BaseModel):
    meeting_id: str
    title: str
    status: str
