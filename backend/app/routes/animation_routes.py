from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os
from pathlib import Path

router = APIRouter()

# Path to animations folder
ANIMATIONS_DIR = Path(__file__).parent.parent.parent / "animations"

@router.get("/list")
async def list_animations():
    """List all available animations"""
    try:
        if not ANIMATIONS_DIR.exists():
            return {"animations": []}
        
        animations = []
        # Support both GLB and FBX formats
        for pattern in ["*.glb", "*.fbx"]:
            for file in ANIMATIONS_DIR.glob(pattern):
                animations.append({
                    "name": file.stem,
                    "filename": file.name,
                    "url": f"/animations/{file.name}",
                    "size": file.stat().st_size,
                    "format": file.suffix[1:].upper()  # GLB or FBX
                })
        
        return {"animations": animations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{filename}")
async def get_animation(filename: str):
    """Serve an animation file (GLB or FBX)"""
    # Security: only allow .glb and .fbx files
    if not (filename.endswith('.glb') or filename.endswith('.fbx')):
        raise HTTPException(status_code=400, detail="Only .glb and .fbx files are supported")
    
    file_path = ANIMATIONS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Animation '{filename}' not found")
    
    # Set appropriate media type
    media_type = "model/gltf-binary" if filename.endswith('.glb') else "application/octet-stream"
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename
    )
