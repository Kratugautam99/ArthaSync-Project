import cv2
import numpy as np
from ultralytics import YOLO


from app.config import settings

# Load model dynamically from settings
model = YOLO(settings.YOLO_MODEL)

def process_frame(image_bytes: bytes) -> dict:
    """
    Process a single frame (image bytes), run YOLO detection,
    and return bounding boxes and item counts.
    """
    # Convert bytes to numpy array
    np_arr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    
    if frame is None:
        raise ValueError("Could not decode image")
    
    # Run YOLO detection with configured confidence and max detections
    results = model(frame, conf=settings.YOLO_CONFIDENCE, max_det=settings.YOLO_MAX_DETECTIONS)
    
    detections = []
    counts = {}
    
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            
            # COCO class name
            class_name = model.names[cls_id]
            
            # Update counts
            counts[class_name] = counts.get(class_name, 0) + 1
            
            detections.append({
                "label": class_name,
                "confidence": conf,
                "box": [x1, y1, x2, y2]
            })
            
    return {
        "detections": detections,
        "counts": counts
    }
