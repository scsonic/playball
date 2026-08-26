# The JavaScript bridge is reached by name from the web page.
-keepclassmembers class com.nexretail.catchchallenge.WebCameraBridge {
    public *;
}
-keepattributes JavascriptInterface
