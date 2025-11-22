# Avatar Animations

This folder contains standard animations for Ready Player Me avatars.

## Animation Files

Store animations in **GLB format** (Binary glTF). These animations work with all RPM avatars because they share a Mixamo-compatible skeleton.

### Required Animations:
1. `idle.glb` - Standing naturally (looping)
2. `talking.glb` - Conversational gestures while speaking (looping)
3. `greeting.glb` - Wave or hello gesture (once)
4. `thinking.glb` - Thoughtful pose, hand on chin (looping)
5. `explaining.glb` - Hand gestures while explaining (looping)
6. `nodding.glb` - Agreement head nod (once or looping)

## How to Get Animations

### Option 1: Mixamo (Recommended)
1. Go to https://www.mixamo.com (requires free Adobe account)
2. Click "Animations" tab
3. Search for animation (e.g., "idle", "talking")
4. Click "Download"
5. Settings:
   - Format: **FBX for Unity**
   - Skin: **Without Skin** (animation only)
   - FPS: 30
   - Keyframe Reduction: None
6. Convert FBX to GLB using:
   - Online: https://products.aspose.app/3d/conversion/fbx-to-glb
   - Or Blender: Import FBX → Export GLB (no materials needed)

### Option 2: Direct GLB Downloads
Some sites offer pre-converted GLB animations:
- https://github.com/KhronosGroup/glTF-Sample-Models
- https://sketchfab.com (filter by GLB/GLTF, downloadable, rigged)

## File Size
- Each animation should be 100KB - 1MB
- Smaller is better for mobile performance

## Testing
After adding animations, they will be available at:
`http://localhost:8000/animations/idle.glb`
`http://localhost:8000/animations/talking.glb`
etc.
