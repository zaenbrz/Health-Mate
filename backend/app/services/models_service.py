import os
import logging
from typing import Optional

import numpy as np
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables when this module is imported
load_dotenv()


def _decode_base64_to_pil(base64_str):
    import base64
    from PIL import Image
    import io

    image_bytes = base64.b64decode(base64_str)
    return Image.open(io.BytesIO(image_bytes))


def _pil_to_normalized_np(pil_image, size=(128, 128)):
    """Convert a PIL image to a normalized float32 numpy array in [0,1].

    Always returns a 2D array (H,W) for grayscale images.
    """
    if pil_image.mode != "L":
        pil_image = pil_image.convert("L")

    pil_resized = pil_image.resize(size)
    arr = np.array(pil_resized, dtype=np.float32)
    if arr.max() > 1.0:
        arr = arr / 255.0
    return arr


class BrainSegmentationService:
    """Brain MRI segmentation service.

    This class loads the Keras `.h5` model lazily and exposes high-level
    async methods used by the API routes. It intentionally keeps preprocessing
    steps local so the inference pipeline matches training notebooks.
    """

    def __init__(self, model_path: Optional[str] = None):
        self._model = None
        default_path = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "models",
                "weights",
                "brain_tumor_model.h5",
            )
        )
        env_path = os.getenv("SEGMENTATION_MODEL_PATH")
        self._model_path = os.path.abspath(model_path or env_path or default_path)
        logger.info(f"Brain segmentation model path: {self._model_path}")

    def _ensure_model_loaded(self):
        if self._model is None:
            try:
                from tensorflow import keras

                if not os.path.exists(self._model_path):
                    raise FileNotFoundError(f"Model not found at: {self._model_path}")
                logger.info(f"Loading brain segmentation model from {self._model_path}")
                self._model = keras.models.load_model(self._model_path, compile=False)
                logger.info("Brain segmentation model loaded")
            except Exception as exc:
                logger.exception("Failed to load brain segmentation model")
                raise

    def predict_mask(self, image_array: np.ndarray) -> np.ndarray:
        """Run the model and return raw predictions.

        The brain tumor model expects 2-channel input (FLAIR + T1CE).
        For single images, we duplicate the channel to create 2-channel input.
        """
        self._ensure_model_loaded()
        if image_array is None:
            raise ValueError("image_array must not be None")

        if image_array.ndim == 2:
            # Single grayscale image (H,W) - duplicate to create 2-channel
            # Stack the same image twice to simulate FLAIR + T1CE
            stacked = np.stack([image_array, image_array], axis=-1)  # (H,W,2)
            batched = np.expand_dims(stacked, axis=0)  # (1,H,W,2)
        elif image_array.ndim == 3:
            if image_array.shape[-1] == 1:
                # (H,W,1) - duplicate channel
                squeezed = np.squeeze(image_array, axis=-1)  # (H,W)
                stacked = np.stack([squeezed, squeezed], axis=-1)  # (H,W,2)
                batched = np.expand_dims(stacked, axis=0)  # (1,H,W,2)
            elif image_array.shape[-1] == 2:
                # Already 2-channel (H,W,2)
                batched = np.expand_dims(image_array, axis=0)  # (1,H,W,2)
            else:
                # (H,W,C) with C > 2 - take first channel and duplicate
                first_channel = image_array[:, :, 0]
                stacked = np.stack([first_channel, first_channel], axis=-1)
                batched = np.expand_dims(stacked, axis=0)
        elif image_array.ndim == 4:
            # Already batched - ensure 2 channels
            if image_array.shape[-1] == 1:
                # (1,H,W,1) - duplicate channel
                squeezed = np.squeeze(image_array, axis=-1)  # (1,H,W)
                stacked = np.stack([squeezed, squeezed], axis=-1)  # (1,H,W,2)
                batched = stacked
            elif image_array.shape[-1] == 2:
                # Already correct shape
                batched = image_array
            else:
                # Take first channel and duplicate
                first_channel = image_array[:, :, :, 0:1]  # (1,H,W,1)
                batched = np.concatenate([first_channel, first_channel], axis=-1)  # (1,H,W,2)
        else:
            raise ValueError(f"Unsupported image array shape: {image_array.shape}")

        preds = self._model.predict(batched)
        return preds

    def predict_from_modalities(self, flair_image, t1ce_image) -> np.ndarray:
        """Preprocess two modalities and run the model.

        Both inputs can be base64 strings, PIL Images or numpy arrays.
        Returns model logits / softmax outputs as numpy array.
        """
        from PIL import Image

        # Accept PIL Image, numpy array or base64 string
        if isinstance(flair_image, str):
            flair_pil = _decode_base64_to_pil(flair_image)
        elif isinstance(flair_image, Image.Image):
            flair_pil = flair_image
        else:
            # numpy array
            from PIL import Image as _Image

            flair_pil = _Image.fromarray(
                (flair_image * 255).astype(np.uint8)
                if flair_image.dtype != np.uint8
                else flair_image
            )

        if isinstance(t1ce_image, str):
            t1ce_pil = _decode_base64_to_pil(t1ce_image)
        elif isinstance(t1ce_image, Image.Image):
            t1ce_pil = t1ce_image
        else:
            from PIL import Image as _Image

            t1ce_pil = _Image.fromarray(
                (t1ce_image * 255).astype(np.uint8)
                if t1ce_image.dtype != np.uint8
                else t1ce_image
            )

        flair_np = _pil_to_normalized_np(flair_pil, size=(128, 128))
        t1ce_np = _pil_to_normalized_np(t1ce_pil, size=(128, 128))

        stacked = np.stack([flair_np, t1ce_np], axis=-1)  # (128,128,2)
        batched = np.expand_dims(stacked, axis=0)  # (1,128,128,2)

        self._ensure_model_loaded()
        preds = self._model.predict(batched)
        return preds

    async def segment_image(self, image_data: str) -> dict:
        """High-level single-image segmentation (base64 input).

        Returns dict with mask base64 and statistics.
        """
        try:
            from PIL import Image
            import io, base64

            pil = _decode_base64_to_pil(image_data)
            arr = _pil_to_normalized_np(pil, size=(128, 128))

            prediction = self.predict_mask(arr)

            # Expect model outputs shape (1,H,W,1) or (1,H,W,C)
            if prediction.ndim == 4:
                mask = prediction[0]
            else:
                mask = prediction

            # Handle multi-class brain tumor segmentation output
            if mask.shape[-1] > 1:
                # Multi-class output - use argmax to get class predictions
                class_pred = np.argmax(mask, axis=-1)
                # Create binary mask (any non-background class)
                binary_mask = (class_pred != 0).astype(np.uint8)
            else:
                # Single channel output - simple threshold
                binary_mask = (mask[..., 0] > 0.5).astype(np.uint8)

            total_pixels = int(binary_mask.size)
            segmented_pixels = int(np.sum(binary_mask))
            segmentation_percentage = float((segmented_pixels / total_pixels) * 100) if total_pixels > 0 else 0.0

            # Convert to PNG base64
            from PIL import Image as _Image
            import io as _io

            mask_image = _Image.fromarray((binary_mask * 255).astype(np.uint8))
            buf = _io.BytesIO()
            mask_image.save(buf, format="PNG")
            mask_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

            return {
                "success": True,
                "segmentation_mask": mask_b64,
                "statistics": {
                    "total_pixels": total_pixels,
                    "segmented_pixels": segmented_pixels,
                    "segmentation_percentage": segmentation_percentage,
                },
                "message": "Image segmentation completed successfully",
            }
        except Exception as e:
            logger.exception("Error in BrainSegmentationService.segment_image")
            return {"success": False, "error": str(e), "message": "Failed to segment image"}

    async def segment_dual_modality(self, flair_image: str, t1ce_image: str) -> dict:
        """High-level dual-modality segmentation from base64 inputs.

        Returns visualization, class statistics and simple insights.
        """
        try:
            # Process original images for display
            flair_pil = _decode_base64_to_pil(flair_image)
            t1ce_pil = _decode_base64_to_pil(t1ce_image)
            
            # Convert original images to base64 for frontend display
            import io as _io
            import base64
            
            # FLAIR image
            flair_buf = _io.BytesIO()
            flair_pil.save(flair_buf, format="PNG")
            flair_b64 = base64.b64encode(flair_buf.getvalue()).decode("utf-8")
            
            # T1CE image
            t1ce_buf = _io.BytesIO()
            t1ce_pil.save(t1ce_buf, format="PNG")
            t1ce_b64 = base64.b64encode(t1ce_buf.getvalue()).decode("utf-8")
            
            preds = self.predict_from_modalities(flair_image, t1ce_image)

            if preds.ndim == 4:
                pred = preds[0]
            else:
                pred = preds

            class_predictions = np.argmax(pred, axis=-1)
            total_pixels = int(class_predictions.size)

            class_stats = {}
            class_names = ["Background", "Necrotic Core", "Edema", "Enhancing Tumor"]
            for i, name in enumerate(class_names):
                pixels = int(np.sum(class_predictions == i))
                percentage = float((pixels / total_pixels) * 100) if total_pixels > 0 else 0.0
                class_stats[name.lower().replace(' ', '_')] = {"pixels": pixels, "percentage": percentage}

            # Create colored visualization with proper tumor region colors
            # Red for Enhancing Tumor, Green for Edema, Blue for Necrotic Core, Black for Background
            colors = np.array([
                [0, 0, 0],        # Background - Black
                [0, 0, 255],      # Necrotic Core - Blue  
                [0, 255, 0],      # Edema - Green
                [255, 0, 0]       # Enhancing Tumor - Red
            ], dtype=np.uint8)
            
            rgb = colors[class_predictions]

            from PIL import Image as _Image

            img = _Image.fromarray(rgb.astype(np.uint8))
            buf = _io.BytesIO()
            img.save(buf, format="PNG")
            img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

            # Generate insights from model output only
            insights = [
                f"Total pixels analyzed: {total_pixels}",
                f"Background: {class_stats.get('background', {}).get('percentage', 0):.2f}%",
                f"Necrotic Core: {class_stats.get('necrotic_core', {}).get('percentage', 0):.2f}%",
                f"Edema: {class_stats.get('edema', {}).get('percentage', 0):.2f}%",
                f"Enhancing Tumor: {class_stats.get('enhancing_tumor', {}).get('percentage', 0):.2f}%"
            ]
            
            recommendations = [
                "Consult with neurosurgeon for clinical interpretation",
                "Results should be correlated with clinical findings"
            ]

            return {
                "success": True,
                "segmentation_result": img_b64,
                "original_images": {
                    "flair": flair_b64,
                    "t1ce": t1ce_b64
                },
                "class_statistics": class_stats,
                "total_pixels": total_pixels,
                "insights": insights,
                "recommendations": recommendations,
                "message": "Dual modality brain segmentation completed successfully",
            }
        except Exception as e:
            logger.exception("Error in BrainSegmentationService.segment_dual_modality")
            return {"success": False, "error": str(e), "message": "Failed to segment dual modality brain scan"}


class KidneySegmentationService:
    """Kidney CT scan segmentation service using ResUNet architecture.
    
    This class loads the ResUNet model for kidney segmentation and provides
    high-level async methods for CT scan analysis.
    """

    def __init__(self, model_path: Optional[str] = None):
        self._model = None
        default_path = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "models",
                "weights",
                "kidney_resunet_best.h5"
            )
        )
        self.model_path = model_path or default_path
        logger.info(f"KidneySegmentationService initialized with model path: {self.model_path}")

    @property
    def model(self):
        """Lazy load the kidney segmentation model."""
        if self._model is None:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Kidney model not found at: {self.model_path}")
            
            try:
                import tensorflow as tf
                
                def dice_coef(y_true, y_pred, smooth=1):
                    y_true_f = tf.keras.backend.flatten(y_true)
                    y_pred_f = tf.keras.backend.flatten(y_pred)
                    intersection = tf.keras.backend.sum(y_true_f * y_pred_f)
                    return (2. * intersection + smooth) / (tf.keras.backend.sum(y_true_f) + tf.keras.backend.sum(y_pred_f) + smooth)
                
                def bce_dice_loss(y_true, y_pred):
                    bce = tf.keras.losses.BinaryCrossentropy()(y_true, y_pred)
                    d = dice_coef(y_true, y_pred)
                    return bce + (1.0 - d)
                
                class DiceMetric(tf.keras.metrics.Metric):
                    def __init__(self, threshold=0.5, name="dice_coef", **kwargs):
                        super(DiceMetric, self).__init__(name=name, **kwargs)
                        self.threshold = threshold
                        self.total = self.add_weight(name="total", initializer="zeros")
                        self.count = self.add_weight(name="count", initializer="zeros")
                    
                    def update_state(self, y_true, y_pred, sample_weight=None):
                        preds = tf.cast(y_pred >= self.threshold, tf.float32)
                        d = dice_coef(y_true, preds)
                        self.total.assign_add(d)
                        self.count.assign_add(1.0)
                    
                    def result(self):
                        return self.total / (self.count + 1e-12)
                    
                    def reset_states(self):
                        self.total.assign(0.0)
                        self.count.assign(0.0)
                
                # Load model with all custom objects
                self._model = tf.keras.models.load_model(
                    self.model_path,
                    custom_objects={
                        'dice_coef': dice_coef,
                        'bce_dice_loss': bce_dice_loss,
                        'DiceMetric': DiceMetric
                    }
                )
                logger.info("Kidney segmentation model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load kidney model: {e}")
                raise
        return self._model

    def predict_mask(self, image_array: np.ndarray) -> np.ndarray:
        """Generate kidney segmentation mask from preprocessed image array."""
        try:
            # Ensure correct input shape for ResUNet (batch_size, height, width, channels)
            if image_array.ndim == 2:
                image_array = np.expand_dims(image_array, axis=-1)  # Add channel dimension
            if image_array.ndim == 3:
                image_array = np.expand_dims(image_array, axis=0)   # Add batch dimension
            
            predictions = self.model.predict(image_array, verbose=0)
            
            # Apply threshold for binary segmentation
            binary_mask = (predictions[0, :, :, 0] > 0.5).astype(np.uint8)
            return binary_mask
            
        except Exception as e:
            logger.error(f"Error in kidney mask prediction: {e}")
            raise

    async def segment_image(self, image_data: str) -> dict:
        """High-level kidney CT segmentation from base64 input."""
        try:
            # Decode and preprocess image
            pil_image = _decode_base64_to_pil(image_data)
            
            # Convert to grayscale and resize to 256x256 for ResUNet
            if pil_image.mode != "L":
                pil_image = pil_image.convert("L")
            
            pil_resized = pil_image.resize((256, 256))
            image_array = np.array(pil_resized, dtype=np.float32) / 255.0
            
            # Generate segmentation mask
            binary_mask = self.predict_mask(image_array)
            
            # Calculate statistics
            total_pixels = int(binary_mask.size)
            kidney_pixels = int(np.sum(binary_mask))
            kidney_percentage = float((kidney_pixels / total_pixels) * 100) if total_pixels > 0 else 0.0
            
            # Generate colored visualization (kidney in red, background in black)
            colored_mask = np.zeros((binary_mask.shape[0], binary_mask.shape[1], 3), dtype=np.uint8)
            colored_mask[binary_mask == 1] = [255, 0, 0]  # Red for kidney
            
            # Convert to base64 for response
            from PIL import Image as _Image
            import io as _io
            import base64
            
            # Save original image for report
            original_buf = _io.BytesIO()
            pil_resized.save(original_buf, format="PNG")
            original_b64 = base64.b64encode(original_buf.getvalue()).decode("utf-8")
            
            # Save colored mask
            mask_image = _Image.fromarray(colored_mask)
            mask_buf = _io.BytesIO()
            mask_image.save(mask_buf, format="PNG")
            mask_b64 = base64.b64encode(mask_buf.getvalue()).decode("utf-8")
            
            # Generate basic insights from model output only
            insights = [
                f"Segmented {kidney_pixels} pixels out of {total_pixels} total pixels",
                f"Segmentation coverage: {kidney_percentage:.2f}% of image area"
            ]
            
            recommendations = [
                "Consult with nephrologist for clinical interpretation",
                "Results should be correlated with clinical findings"
            ]
            
            return {
                "success": True,
                "segmentation_mask": mask_b64,
                "original_image": original_b64,
                "statistics": {
                    "total_pixels": total_pixels,
                    "kidney_pixels": kidney_pixels,
                    "kidney_percentage": kidney_percentage,
                    "segmented_pixels": kidney_pixels,
                    "segmentation_percentage": kidney_percentage
                },
                "insights": insights,
                "recommendations": recommendations,
                "message": "Kidney CT segmentation completed successfully",
            }
            
        except Exception as e:
            logger.exception("Error in KidneySegmentationService.segment_image")
            return {"success": False, "error": str(e), "message": "Failed to segment kidney CT scan"}


class BreastSegmentationService:
    """Breast ultrasound segmentation service.
    
    This class loads the breast segmentation model and provides
    high-level async methods for ultrasound analysis.
    """

    def __init__(self, model_path: Optional[str] = None):
        self._model = None
        default_path = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "models",
                "weights",
                "breast_segmentation_model.h5"
            )
        )
        self.model_path = model_path or default_path
        logger.info(f"BreastSegmentationService initialized with model path: {self.model_path}")

    @property
    def model(self):
        """Lazy load the breast segmentation model."""
        if self._model is None:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Breast model not found at: {self.model_path}")
            
            try:
                import tensorflow as tf
                
                # Create a custom Conv2DTranspose that ignores unsupported parameters
                class CompatibleConv2DTranspose(tf.keras.layers.Conv2DTranspose):
                    def __init__(self, *args, **kwargs):
                        # Remove unsupported parameters for older TensorFlow versions
                        kwargs.pop('groups', None)
                        kwargs.pop('output_padding', None)
                        super().__init__(*args, **kwargs)
                
                custom_objects = {
                    'Conv2DTranspose': CompatibleConv2DTranspose
                }
                
                # Try multiple loading strategies
                try:
                    self._model = tf.keras.models.load_model(
                        self.model_path, 
                        compile=False, 
                        custom_objects=custom_objects
                    )
                    logger.info("Breast segmentation model loaded successfully with custom objects")
                except Exception as e:
                    logger.warning(f"Custom objects loading failed: {e}")
                    try:
                        self._model = tf.keras.models.load_model(
                            self.model_path, 
                            compile=False,
                            safe_mode=False
                        )
                        logger.info("Breast segmentation model loaded successfully with safe_mode=False")
                    except Exception as e2:
                        logger.warning(f"Safe mode loading failed: {e2}")
                        self._model = tf.keras.models.load_model(self.model_path, compile=False)
                        logger.info("Breast segmentation model loaded successfully with standard method")
                        
            except Exception as e:
                logger.error(f"Failed to load breast model: {e}")
                raise
        return self._model

    def predict_mask(self, image_array: np.ndarray) -> np.ndarray:
        """Generate breast lesion segmentation mask from preprocessed image array."""
        try:
            # Ensure correct input shape for model
            if image_array.ndim == 2:
                image_array = np.expand_dims(image_array, axis=-1)  # Add channel dimension
            if image_array.ndim == 3:
                image_array = np.expand_dims(image_array, axis=0)   # Add batch dimension
            
            predictions = self.model.predict(image_array, verbose=0)
            
            # Handle different prediction output shapes
            if predictions.ndim == 4:  # (batch, height, width, channels)
                mask = predictions[0]  # Remove batch dimension
            elif predictions.ndim == 3:  # (batch, height, width)
                mask = predictions[0]  # Remove batch dimension
            else:
                mask = predictions
            
            # Ensure mask is 2D
            if mask.ndim == 3:
                if mask.shape[-1] == 1:
                    mask = mask.squeeze(-1)
                else:
                    mask = mask[:, :, 0]
            
            # Apply threshold for binary segmentation
            binary_mask = (mask > 0.5).astype(np.uint8)
            return binary_mask
            
        except Exception as e:
            logger.error(f"Error in breast mask prediction: {e}")
            raise

    async def segment_image(self, image_data: str) -> dict:
        """High-level breast ultrasound segmentation from base64 input."""
        try:
            # Decode and preprocess image
            pil_image = _decode_base64_to_pil(image_data)
            
            # Convert to grayscale and resize to 128x128 for breast model
            if pil_image.mode != "L":
                pil_image = pil_image.convert("L")
            
            pil_resized = pil_image.resize((128, 128))
            image_array = np.array(pil_resized, dtype=np.float32) / 255.0
            
            # Generate segmentation mask
            binary_mask = self.predict_mask(image_array)
            
            # Calculate statistics
            total_pixels = int(binary_mask.size)
            lesion_pixels = int(np.sum(binary_mask))
            lesion_percentage = float((lesion_pixels / total_pixels) * 100) if total_pixels > 0 else 0.0
            
            # Generate colored visualization (lesions in red, background in black)
            colored_mask = np.zeros((binary_mask.shape[0], binary_mask.shape[1], 3), dtype=np.uint8)
            colored_mask[binary_mask == 1] = [255, 0, 0]  # Red for lesions
            
            # Convert to base64 for response
            from PIL import Image as _Image
            import io as _io
            import base64
            
            # Save original image for report
            original_buf = _io.BytesIO()
            pil_resized.save(original_buf, format="PNG")
            original_b64 = base64.b64encode(original_buf.getvalue()).decode("utf-8")
            
            # Save colored mask
            mask_image = _Image.fromarray(colored_mask)
            mask_buf = _io.BytesIO()
            mask_image.save(mask_buf, format="PNG")
            mask_b64 = base64.b64encode(mask_buf.getvalue()).decode("utf-8")
            
            # Generate basic insights from model output only
            insights = [
                f"Segmented {lesion_pixels} pixels out of {total_pixels} total pixels",
                f"Segmentation coverage: {lesion_percentage:.2f}% of image area"
            ]
            
            recommendations = [
                "Consult with radiologist for clinical interpretation",
                "Results should be correlated with clinical findings"
            ]
            
            return {
                "success": True,
                "segmentation_mask": mask_b64,
                "original_image": original_b64,
                "statistics": {
                    "total_pixels": total_pixels,
                    "lesion_pixels": lesion_pixels,
                    "lesion_percentage": lesion_percentage,
                    "segmented_pixels": lesion_pixels,
                    "segmentation_percentage": lesion_percentage
                },
                "insights": insights,
                "recommendations": recommendations,
                "message": "Breast ultrasound segmentation completed successfully",
            }
            
        except Exception as e:
            logger.exception("Error in BreastSegmentationService.segment_image")
            return {"success": False, "error": str(e), "message": "Failed to segment breast ultrasound"}


class PancreasSegmentationService:
    """Pancreas CT scan segmentation service using ResUNet architecture.
    
    This class loads the ResUNet model for pancreas segmentation and provides
    high-level async methods for CT scan analysis.
    """

    def __init__(self, model_path: Optional[str] = None):
        self._model = None
        default_path = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "models",
                "weights",
                "resunet_effb0_best.h5"
            )
        )
        self.model_path = model_path or default_path
        logger.info(f"PancreasSegmentationService initialized with model path: {self.model_path}")

    @property
    def model(self):
        """Lazy load the pancreas segmentation model."""
        if self._model is None:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Pancreas model not found at: {self.model_path}")
            
            try:
                import tensorflow as tf
                
                # Rebuild the exact architecture from the notebook
                def build_unet_effb0(input_shape=(256, 256, 3), dropout=0.15):
                    """Rebuild ResUNet with EfficientNetB0 backbone - matches training notebook exactly"""
                    base_model = tf.keras.applications.EfficientNetB0(
                        include_top=False, 
                        input_shape=input_shape, 
                        weights=None  # We'll load weights from h5 file
                    )
                    
                    # Get skip connections at specific layers (matching notebook)
                    skip1 = base_model.get_layer("block2a_expand_activation").output   # 128x128
                    skip2 = base_model.get_layer("block3a_expand_activation").output   # 64x64
                    skip3 = base_model.get_layer("block4a_expand_activation").output   # 32x32
                    x = base_model.get_layer("block6a_expand_activation").output       # 16x16

                    def up_concat(x, skip, filters):
                        x = tf.keras.layers.UpSampling2D((2, 2))(x)
                        x = tf.keras.layers.Concatenate()([x, skip])
                        x = tf.keras.layers.Conv2D(filters, 3, padding="same", kernel_initializer="he_normal")(x)
                        x = tf.keras.layers.BatchNormalization()(x)
                        x = tf.keras.layers.Activation("relu")(x)
                        x = tf.keras.layers.Conv2D(filters, 3, padding="same", kernel_initializer="he_normal")(x)
                        x = tf.keras.layers.BatchNormalization()(x)
                        x = tf.keras.layers.Activation("relu")(x)
                        return x

                    # Decoder path (matching notebook)
                    d1 = up_concat(x, skip3, 256)       # 16 -> 32
                    d2 = up_concat(d1, skip2, 128)      # 32 -> 64
                    d3 = up_concat(d2, skip1, 64)       # 64 -> 128
                    d4 = tf.keras.layers.UpSampling2D((2, 2))(d3)  # 128 -> 256
                    d4 = tf.keras.layers.Conv2D(32, 3, padding="same", kernel_initializer="he_normal")(d4)
                    d4 = tf.keras.layers.BatchNormalization()(d4)
                    d4 = tf.keras.layers.Activation("relu")(d4)
                    d4 = tf.keras.layers.Dropout(dropout)(d4)

                    outputs = tf.keras.layers.Conv2D(1, (1, 1), activation="sigmoid")(d4)
                    model = tf.keras.Model(inputs=base_model.input, outputs=outputs)
                    return model
                
                logger.info("Reconstructing ResUNet-EfficientNetB0 architecture...")
                self._model = build_unet_effb0(input_shape=(256, 256, 3), dropout=0.15)
                
                # Now load the weights from the h5 file
                logger.info(f"Loading weights from {self.model_path}...")
                self._model.load_weights(self.model_path)
                
                logger.info(f"Pancreas model loaded successfully!")
                logger.info(f"Input shape: {self._model.input_shape}")
                logger.info(f"Output shape: {self._model.output_shape}")
                logger.info("Expected input: 3-channel RGB (256x256x3) with EfficientNet preprocessing")
                
            except Exception as e:
                logger.error(f"Failed to load pancreas model: {e}")
                raise
        return self._model

    def predict_mask(self, image_array: np.ndarray, threshold: float = 0.5, keep_largest: bool = True) -> tuple:
        """Generate pancreas segmentation mask with dynamic preprocessing and postprocessing.
        
        The model expects 3-channel RGB input (256x256x3) with EfficientNet preprocessing.
        
        Returns:
            tuple: (binary_mask, probability_map) - binary mask and raw probabilities
        """
        try:
            # Ensure 3-channel RGB input (model was trained on RGB)
            if image_array.ndim == 2:
                # Grayscale (H,W) -> RGB (H,W,3)
                image_array = np.repeat(image_array[..., np.newaxis], 3, axis=-1)
            elif image_array.ndim == 3:
                if image_array.shape[-1] == 1:
                    # (H,W,1) -> (H,W,3)
                    image_array = np.repeat(image_array, 3, axis=-1)
                elif image_array.shape[-1] != 3:
                    # If more than 3 channels, take first 3
                    image_array = image_array[:, :, :3]
            
            # Add batch dimension if needed
            if image_array.ndim == 3:
                image_array = np.expand_dims(image_array, axis=0)
            
            # Apply EfficientNet preprocessing (expects values in 0-255 range)
            import tensorflow as tf
            img_input = image_array * 255.0
            img_input = tf.keras.applications.efficientnet.preprocess_input(img_input)
            
            logger.info(f"Input shape for prediction: {img_input.shape}")
            
            # Predict using the model
            predictions = self.model.predict(img_input, verbose=0)
            
            # Extract prediction probabilities
            prob_map = predictions[0, ..., 0]
            
            # Apply threshold for binary segmentation
            binary_mask = (prob_map >= threshold).astype(np.uint8)
            
            # Postprocessing: keep only the largest connected component (like in notebook)
            if keep_largest and np.sum(binary_mask) > 0:
                try:
                    import cv2
                    num_labels, labels = cv2.connectedComponents(binary_mask.astype(np.uint8))
                    if num_labels > 1:  # More than just background
                        # Find largest component (excluding background label 0)
                        areas = [(labels == i).sum() for i in range(1, num_labels)]
                        if areas:
                            largest_idx = 1 + int(np.argmax(areas))
                            binary_mask = (labels == largest_idx).astype(np.uint8)
                            logger.info(f"Postprocessing: kept largest component out of {num_labels-1} regions")
                except Exception as e:
                    logger.warning(f"Postprocessing failed, using thresholded mask: {e}")
            
            logger.info(f"Prediction completed. Pancreas pixels: {np.sum(binary_mask)}/{binary_mask.size}")
            return binary_mask, prob_map
            
        except Exception as e:
            logger.error(f"Error in pancreas mask prediction: {e}")
            raise

    async def segment_image(self, image_data: str) -> dict:
        """High-level pancreas CT segmentation from base64 input."""
        try:
            # Decode and preprocess image
            pil_image = _decode_base64_to_pil(image_data)
            
            # Convert to grayscale and resize to 256x256
            if pil_image.mode != "L":
                pil_image = pil_image.convert("L")
            
            pil_resized = pil_image.resize((256, 256))
            image_array = np.array(pil_resized, dtype=np.float32) / 255.0
            
            # The predict_mask method handles RGB conversion internally
            # Just pass the normalized grayscale image
            binary_mask, probability_map = self.predict_mask(image_array, threshold=0.5, keep_largest=True)
            
            # Calculate statistics
            total_pixels = int(binary_mask.size)
            pancreas_pixels = int(np.sum(binary_mask))
            pancreas_percentage = float((pancreas_pixels / total_pixels) * 100) if total_pixels > 0 else 0.0
            
            # Calculate additional metrics (like in notebook)
            dice_score = 0.0  # Would need ground truth for actual dice
            iou_score = 0.0   # Would need ground truth for actual IoU
            confidence_score = float(np.mean(probability_map[binary_mask == 1])) if pancreas_pixels > 0 else 0.0
            
            # Generate colored visualization (pancreas in red, background in black)
            colored_mask = np.zeros((binary_mask.shape[0], binary_mask.shape[1], 3), dtype=np.uint8)
            colored_mask[binary_mask == 1] = [255, 0, 0]  # Red for pancreas
            
            # Convert to base64 for response
            from PIL import Image as _Image
            import io as _io
            import base64
            
            # Save original image for report
            original_buf = _io.BytesIO()
            pil_resized.save(original_buf, format="PNG")
            original_b64 = base64.b64encode(original_buf.getvalue()).decode("utf-8")
            
            # Save colored mask
            mask_image = _Image.fromarray(colored_mask)
            mask_buf = _io.BytesIO()
            mask_image.save(mask_buf, format="PNG")
            mask_b64 = base64.b64encode(mask_buf.getvalue()).decode("utf-8")
            
            # Generate basic insights from model output only
            insights = [
                f"Segmented {pancreas_pixels} pixels out of {total_pixels} total pixels",
                f"Segmentation coverage: {pancreas_percentage:.2f}% of image area",
                f"Model confidence score: {confidence_score:.2f}"
            ]
            
            recommendations = [
                "Consult with gastroenterologist for clinical interpretation",
                "Results should be correlated with clinical findings"
            ]
            
            return {
                "success": True,
                "segmentation_mask": mask_b64,
                "original_image": original_b64,
                "statistics": {
                    "total_pixels": total_pixels,
                    "pancreas_pixels": pancreas_pixels,
                    "pancreas_percentage": pancreas_percentage,
                    "segmented_pixels": pancreas_pixels,
                    "segmentation_percentage": pancreas_percentage,
                    "confidence_score": confidence_score,
                    "image_dimensions": f"{binary_mask.shape[0]}x{binary_mask.shape[1]}",
                    "processing_notes": "Processed with EfficientNetB0-based ResUNet, postprocessed with largest component selection"
                },
                "model_info": {
                    "architecture": "ResUNet with EfficientNetB0 backbone",
                    "input_size": "256x256",
                    "preprocessing": "RGB conversion + EfficientNet preprocessing",
                    "postprocessing": "Connected component analysis with largest region selection",
                    "threshold": 0.5,
                    "trained_on": "Pancreas CT segmentation dataset"
                },
                "insights": insights,
                "recommendations": recommendations,
                "message": "Pancreas CT segmentation completed successfully",
            }
            
        except Exception as e:
            logger.exception("Error in PancreasSegmentationService.segment_image")
            return {"success": False, "error": str(e), "message": "Failed to segment pancreas CT scan"}


class LiverSegmentationService:
    """Liver CT scan segmentation service using U-Net with ResNet50 backbone.
    
    This class loads a PyTorch model for liver and tumor segmentation.
    Model outputs 3 classes: Background (0), Liver (1), Tumor (2)
    """

    def __init__(self, model_path: Optional[str] = None):
        self._model = None
        default_path = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "models",
                "weights",
                "liver_model.pth"
            )
        )
        self.model_path = model_path or default_path
        logger.info(f"LiverSegmentationService initialized with model path: {self.model_path}")

    def build_unet_resnet50(self, n_classes=3):
        """Build U-Net with ResNet50 backbone using FastAI's DynamicUnet."""
        try:
            from fastai.vision.all import DynamicUnet, create_body
            from torchvision.models import resnet50
            import torch.nn as nn
            
            # Create ResNet50 model instance (without pretrained weights)
            resnet_model = resnet50(pretrained=False)
            
            # Extract encoder (convolutional layers without classification head)
            encoder = create_body(resnet_model, pretrained=False, cut=-2)
            
            # Build U-Net with ResNet50 backbone
            # Image size 128x128, 3 output classes
            model = DynamicUnet(encoder, n_classes, (128, 128))
            
            return model
        except Exception as e:
            logger.error(f"Error building U-Net model: {e}")
            raise

    @property
    def model(self):
        """Lazy load the liver segmentation model."""
        if self._model is None:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Liver model not found at: {self.model_path}")
            
            try:
                import torch
                
                logger.info(f"Loading liver segmentation model from {self.model_path}...")
                
                # Build the model architecture
                model = self.build_unet_resnet50(n_classes=3)
                
                # Load the state dict
                state_dict = torch.load(self.model_path, map_location='cpu')
                model.load_state_dict(state_dict)
                
                # Set to evaluation mode
                model.eval()
                
                self._model = model
                
                logger.info("Liver segmentation model loaded successfully")
                logger.info(f"Model classes: Background (0), Liver (1), Tumor (2)")
                
            except Exception as e:
                logger.error(f"Failed to load liver model: {e}")
                raise
        return self._model

    def predict_mask(self, image_array: np.ndarray) -> tuple:
        """Generate liver segmentation mask from preprocessed image array.
        
        Args:
            image_array: RGB image array of shape (128, 128, 3)
            
        Returns:
            tuple: (class_mask, probabilities) - class predictions and probability maps
        """
        try:
            import torch
            import torch.nn.functional as F
            
            # Ensure RGB format
            if image_array.ndim == 2:
                image_array = np.repeat(image_array[..., np.newaxis], 3, axis=-1)
            elif image_array.shape[-1] == 1:
                image_array = np.repeat(image_array, 3, axis=-1)
            
            # Normalize to [0, 1]
            if image_array.max() > 1.0:
                image_array = image_array.astype(np.float32) / 255.0
            
            # Convert to PyTorch tensor: (H, W, C) -> (1, C, H, W)
            image_tensor = torch.from_numpy(image_array).permute(2, 0, 1).unsqueeze(0).float()
            
            # FastAI normalization (ImageNet stats)
            mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
            std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
            image_tensor = (image_tensor - mean) / std
            
            # Predict
            with torch.no_grad():
                output = self.model(image_tensor)  # Shape: (1, 3, 128, 128)
            
            # Apply softmax to get probabilities
            probs = F.softmax(output, dim=1)[0]  # Shape: (3, 128, 128)
            probs_np = probs.cpu().numpy()
            
            # Get class predictions
            class_mask = torch.argmax(output, dim=1)[0].cpu().numpy()  # Shape: (128, 128)
            
            logger.info(f"Prediction completed. Mask shape: {class_mask.shape}")
            logger.info(f"Class distribution - Background: {np.sum(class_mask == 0)}, Liver: {np.sum(class_mask == 1)}, Tumor: {np.sum(class_mask == 2)}")
            
            return class_mask, probs_np
            
        except Exception as e:
            logger.error(f"Error in liver mask prediction: {e}")
            raise

    async def segment_image(self, image_data: str) -> dict:
        """High-level liver CT segmentation from base64 input."""
        try:
            # Decode and preprocess image
            pil_image = _decode_base64_to_pil(image_data)
            
            # Convert to RGB and resize to 128x128 (model input size)
            if pil_image.mode != "RGB":
                pil_image = pil_image.convert("RGB")
            
            pil_resized = pil_image.resize((128, 128))
            image_array = np.array(pil_resized, dtype=np.uint8)
            
            # Generate segmentation mask
            class_mask, probabilities = self.predict_mask(image_array)
            
            # Calculate statistics for each class
            total_pixels = int(class_mask.size)
            background_pixels = int(np.sum(class_mask == 0))
            liver_pixels = int(np.sum(class_mask == 1))
            tumor_pixels = int(np.sum(class_mask == 2))
            
            background_percentage = float((background_pixels / total_pixels) * 100)
            liver_percentage = float((liver_pixels / total_pixels) * 100)
            tumor_percentage = float((tumor_pixels / total_pixels) * 100)
            
            # Calculate confidence scores for each class
            background_confidence = float(np.mean(probabilities[0][class_mask == 0])) if background_pixels > 0 else 0.0
            liver_confidence = float(np.mean(probabilities[1][class_mask == 1])) if liver_pixels > 0 else 0.0
            tumor_confidence = float(np.mean(probabilities[2][class_mask == 2])) if tumor_pixels > 0 else 0.0
            
            # Generate colored visualization
            # Background: Black, Liver: Green, Tumor: Red
            colored_mask = np.zeros((class_mask.shape[0], class_mask.shape[1], 3), dtype=np.uint8)
            colored_mask[class_mask == 1] = [0, 255, 0]    # Liver - Green
            colored_mask[class_mask == 2] = [255, 0, 0]    # Tumor - Red
            
            # Convert to base64 for response
            from PIL import Image as _Image
            import io as _io
            import base64
            
            # Save original image for report
            original_buf = _io.BytesIO()
            pil_resized.save(original_buf, format="PNG")
            original_b64 = base64.b64encode(original_buf.getvalue()).decode("utf-8")
            
            # Save colored mask
            mask_image = _Image.fromarray(colored_mask)
            mask_buf = _io.BytesIO()
            mask_image.save(mask_buf, format="PNG")
            mask_b64 = base64.b64encode(mask_buf.getvalue()).decode("utf-8")
            
            # Generate basic insights from model output only
            insights = [
                f"Total pixels analyzed: {total_pixels}",
                f"Background: {background_percentage:.2f}%",
                f"Liver tissue: {liver_percentage:.2f}%",
                f"Tumor tissue: {tumor_percentage:.2f}%"
            ]
            
            if liver_pixels > 0:
                insights.append(f"Liver confidence: {liver_confidence:.2f}")
            if tumor_pixels > 0:
                insights.append(f"Tumor confidence: {tumor_confidence:.2f}")
            
            recommendations = [
                "Consult with hepatologist or oncologist for clinical interpretation",
                "Results should be correlated with clinical findings"
            ]
            
            return {
                "success": True,
                "segmentation_mask": mask_b64,
                "original_image": original_b64,
                "statistics": {
                    "total_pixels": total_pixels,
                    "background_pixels": background_pixels,
                    "liver_pixels": liver_pixels,
                    "tumor_pixels": tumor_pixels,
                    "background_percentage": background_percentage,
                    "liver_percentage": liver_percentage,
                    "tumor_percentage": tumor_percentage,
                    "liver_confidence": liver_confidence,
                    "tumor_confidence": tumor_confidence,
                    "image_dimensions": f"{class_mask.shape[0]}x{class_mask.shape[1]}"
                },
                "class_statistics": {
                    "background": {"pixels": background_pixels, "percentage": background_percentage},
                    "liver": {"pixels": liver_pixels, "percentage": liver_percentage},
                    "tumor": {"pixels": tumor_pixels, "percentage": tumor_percentage}
                },
                "model_info": {
                    "architecture": "U-Net with ResNet50 backbone (FastAI)",
                    "input_size": "128x128",
                    "preprocessing": "RGB conversion + FastAI normalization",
                    "classes": ["Background (0)", "Liver (1)", "Tumor (2)"],
                    "trained_on": "Liver tumor segmentation dataset"
                },
                "insights": insights,
                "recommendations": recommendations,
                "message": "Liver CT segmentation completed successfully",
            }
            
        except Exception as e:
            logger.exception("Error in LiverSegmentationService.segment_image")
            return {"success": False, "error": str(e), "message": "Failed to segment liver CT scan"}


# Singleton instances exposed for use by routes
brain_segmentation_service = BrainSegmentationService()
kidney_segmentation_service = KidneySegmentationService()
breast_segmentation_service = BreastSegmentationService()
pancreas_segmentation_service = PancreasSegmentationService()
liver_segmentation_service = LiverSegmentationService()