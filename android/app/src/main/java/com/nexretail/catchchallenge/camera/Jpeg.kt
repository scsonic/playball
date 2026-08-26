package com.nexretail.catchchallenge.camera

import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.media.Image
import java.io.ByteArrayOutputStream

/**
 * NV21 → JPEG. Shared by both camera sources.
 *
 * UVC frame callbacks already hand us NV21; Camera2 hands us YUV_420_888, which is
 * converted first. Either way the encode happens off the main thread.
 */
fun nv21ToJpeg(nv21: ByteArray, width: Int, height: Int, quality: Int): ByteArray? {
    val out = ByteArrayOutputStream(width * height / 4)
    return if (YuvImage(nv21, ImageFormat.NV21, width, height, null)
            .compressToJpeg(Rect(0, 0, width, height), quality, out)
    ) {
        out.toByteArray()
    } else {
        null
    }
}

/**
 * YUV_420_888 → NV21.
 *
 * Handles row and pixel strides properly: cameras routinely hand back padded
 * buffers, and ignoring the strides is what produces the classic green-skew image.
 */
fun Image.toNv21(): ByteArray? {
    if (format != ImageFormat.YUV_420_888) return null

    val width = width
    val height = height
    val nv21 = ByteArray(width * height * 3 / 2)

    val yPlane = planes[0]
    val uPlane = planes[1]
    val vPlane = planes[2]

    var outputOffset = 0
    val yBuffer = yPlane.buffer
    val yRowStride = yPlane.rowStride
    val yPixelStride = yPlane.pixelStride
    val rowBuffer = ByteArray(yRowStride)
    for (row in 0 until height) {
        yBuffer.position(row * yRowStride)
        if (yPixelStride == 1) {
            val length = minOf(width, yBuffer.remaining())
            yBuffer.get(nv21, outputOffset, length)
            outputOffset += width
        } else {
            val length = minOf(yRowStride, yBuffer.remaining())
            yBuffer.get(rowBuffer, 0, length)
            for (col in 0 until width) nv21[outputOffset++] = rowBuffer[col * yPixelStride]
        }
    }

    val chromaHeight = height / 2
    val chromaWidth = width / 2
    val uBuffer = uPlane.buffer
    val vBuffer = vPlane.buffer
    val uRowStride = uPlane.rowStride
    val vRowStride = vPlane.rowStride
    val uPixelStride = uPlane.pixelStride
    val vPixelStride = vPlane.pixelStride

    for (row in 0 until chromaHeight) {
        for (col in 0 until chromaWidth) {
            val vIndex = row * vRowStride + col * vPixelStride
            val uIndex = row * uRowStride + col * uPixelStride
            if (vIndex >= vBuffer.limit() || uIndex >= uBuffer.limit()) continue
            nv21[outputOffset++] = vBuffer.get(vIndex)
            nv21[outputOffset++] = uBuffer.get(uIndex)
        }
    }
    return nv21
}
