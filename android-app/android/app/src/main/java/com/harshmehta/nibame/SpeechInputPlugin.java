package com.harshmehta.nibame;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(
    name = "SpeechInput",
    permissions = {
        @Permission(
            alias = "microphone",
            strings = { Manifest.permission.RECORD_AUDIO }
        )
    }
)
public class SpeechInputPlugin extends Plugin implements RecognitionListener {
    private SpeechRecognizer recognizer;
    private PluginCall activeCall;

    @PluginMethod
    public void start(PluginCall call) {
        if (activeCall != null) {
            call.reject("Voice input is already active.");
            return;
        }
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermission");
            return;
        }
        beginRecognition(call);
    }

    @PermissionCallback
    private void microphonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            beginRecognition(call);
        } else {
            call.reject("Microphone permission was not granted.");
        }
    }

    private void beginRecognition(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.unavailable("Speech recognition is unavailable on this device.");
            return;
        }
        activeCall = call;
        getActivity().runOnUiThread(() -> {
            destroyRecognizer();
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(this);
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            );
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag());
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            recognizer.startListening(intent);
        });
    }

    @Override
    public void onResults(Bundle results) {
        ArrayList<String> matches =
            results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (activeCall == null) {
            destroyRecognizer();
            return;
        }
        if (matches == null || matches.isEmpty()) {
            activeCall.reject("No speech was recognized.");
        } else {
            JSObject response = new JSObject();
            response.put("text", matches.get(0));
            activeCall.resolve(response);
        }
        activeCall = null;
        destroyRecognizer();
    }

    @Override
    public void onError(int error) {
        if (activeCall != null) {
            activeCall.reject("Voice input could not be completed.");
            activeCall = null;
        }
        destroyRecognizer();
    }

    private void destroyRecognizer() {
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        destroyRecognizer();
        super.handleOnDestroy();
    }

    @Override public void onReadyForSpeech(Bundle params) {}
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() {}
    @Override public void onPartialResults(Bundle partialResults) {}
    @Override public void onEvent(int eventType, Bundle params) {}
}
