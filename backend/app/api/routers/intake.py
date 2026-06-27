"""Voice-first intake endpoints — the "one big button" backend.

* POST /intake/voice : audio in -> transcript + structured draft case out.
  The client records once; on confirm it creates the case and (optionally)
  re-uploads the same audio to /cases/{id}/voice as the person's voice sample.
* POST /intake/parse : already-have-text path (e.g. browser Web Speech API did
  the transcription on-device, which also keeps it working on 2G).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.api.deps import CurrentUser, get_current_user
from app.services.intake_service import parse_transcript
from app.voice import stt

router = APIRouter(prefix="/intake", tags=["intake"])


class ParseTextRequest(BaseModel):
    transcript: str
    case_type: Optional[str] = None
    language: Optional[str] = None


@router.post("/parse")
def parse_text(payload: ParseTextRequest, user: CurrentUser = Depends(get_current_user)):
    draft = parse_transcript(payload.transcript, payload.case_type)
    return {"transcript": payload.transcript, "draft": draft}


@router.post("/voice")
async def parse_voice(
    file: UploadFile = File(...),
    case_type: str = Form(default=""),
    language: str = Form(default=""),
    user: CurrentUser = Depends(get_current_user),
):
    blob = await file.read()
    if not blob:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty audio")
    transcript = stt.transcribe(blob, file.content_type or "audio/webm", language or None)
    if not transcript:
        # STT unavailable/failed — tell the client to use on-device transcription.
        return {
            "transcript": None,
            "draft": None,
            "stt_available": False,
            "message": "Server STT is not configured. Use on-device speech-to-text and call /intake/parse.",
        }
    draft = parse_transcript(transcript, case_type or None)
    return {"transcript": transcript, "draft": draft, "stt_available": True}
