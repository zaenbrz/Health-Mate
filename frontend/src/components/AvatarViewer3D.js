import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import CONFIG from '../config';

const AvatarViewer3D = forwardRef(({ avatarUrl, audioUrl, autoPlay = false, style, onAvatarLoaded, onAudioEnded }, ref) => {
  const webViewRef = useRef(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [htmlUri, setHtmlUri] = useState(null);

  useEffect(() => {
    loadHtmlFile();
  }, []);

  async function loadHtmlFile() {
    try {
      console.log('🔄 Loading avatar-viewer.html...');
      const asset = Asset.fromModule(require('../../assets/avatar-viewer.html'));
      await asset.downloadAsync();
      const uri = asset.localUri || asset.uri;
      console.log('✅ Working HTML loaded:', uri);
      setHtmlUri(uri);
    } catch (error) {
      console.error('❌ Failed to load avatar viewer HTML:', error);
    }
  }

  useEffect(() => {
    if (viewerReady && avatarUrl) {
      // Proxy the GLB through backend to avoid CORS issues
      const proxiedUrl = `${CONFIG.API_URL}/avatar/proxy-glb?url=${encodeURIComponent(avatarUrl)}`;
      console.log('🔵 Loading avatar...');
      console.log('  Original URL:', avatarUrl);
      console.log('  Proxied URL:', proxiedUrl);
      console.log('  Viewer ready:', viewerReady);
      sendMessage({ type: 'loadAvatar', url: proxiedUrl });
    } else {
      console.log('⏸️ Avatar loading conditions:', { viewerReady, avatarUrl: !!avatarUrl });
    }
  }, [viewerReady, avatarUrl]);

  useEffect(() => {
    if (viewerReady && autoPlay && audioUrl) {
      sendMessage({ type: 'playAudio', url: audioUrl });
    }
  }, [viewerReady, audioUrl, autoPlay]);

  function sendMessage(data) {
    if (webViewRef.current) {
      console.log('📤 Sending message to WebView:', data);
      webViewRef.current.postMessage(JSON.stringify(data));
    } else {
      console.warn('⚠️ WebView ref not available');
    }
  }

  function handleMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle console messages from WebView
      if (data.type === 'console') {
        const prefix = data.level === 'error' ? '❌ WebView:' : 
                      data.level === 'warn' ? '⚠️ WebView:' : '💬 WebView:';
        console.log(prefix, data.message);
        return;
      }
      
      console.log('Avatar viewer message:', data);

      switch (data.type) {
        case 'ready':
          setViewerReady(true);
          break;
        case 'loaded':
          console.log('Avatar loaded successfully');
          if (onAvatarLoaded) {
            onAvatarLoaded();
          }
          break;
        case 'morphsFound':
          console.log('Available morphs:', data.morphs);
          break;
        case 'animationLoaded':
          console.log('✅ Animation loaded:', data);
          break;
        case 'animationPlaying':
          console.log('▶️ Animation playing:', data.name);
          break;
        case 'animationStopped':
          console.log('⏹️ Animation stopped');
          break;
        case 'error':
          console.error('Avatar viewer error:', data.message);
          break;
        case 'audioEnded':
          console.log('Audio playback ended');
          if (onAudioEnded) {
            onAudioEnded();
          }
          break;
      }
    } catch (error) {
      console.error('Failed to parse viewer message:', error);
    }
  }

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    playAudio: (url) => sendMessage({ type: 'playAudio', url }),
    stopAudio: () => sendMessage({ type: 'stopAudio' }),
    playAudioWithLipsync: (audioUrl, visemes) => sendMessage({ type: 'playAudioWithLipsync', audioUrl, visemes }),
    testMorph: (strength = 1, duration = 800) => sendMessage({ type: 'testMorph', strength, duration }),
    loadAvatar: (url) => sendMessage({ type: 'loadAvatar', url }),
    loadAnimation: (url) => sendMessage({ type: 'loadAnimation', url }),
    playAnimation: (name, loop = true, fadeDuration = 0.5) => sendMessage({ type: 'playAnimation', name, loop, fadeDuration }),
    stopAnimation: (fadeDuration = 0.5) => sendMessage({ type: 'stopAnimation', fadeDuration }),
    injectJavaScript: (script) => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(script);
      }
    },
  }));

  if (!htmlUri) {
    console.log('⏳ Waiting for HTML file to load...');
    return <View style={[styles.container, style]} />;
  }

  console.log('✅ Rendering AvatarViewer3D with HTML:', htmlUri);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ uri: htmlUri }}
        onMessage={handleMessage}
        injectedJavaScript={`
          // Override console methods to send to React Native
          (function() {
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;
            
            console.log = function(...args) {
              originalLog.apply(console, args);
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'console',
                level: 'log',
                message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
              }));
            };
            
            console.error = function(...args) {
              originalError.apply(console, args);
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'console',
                level: 'error',
                message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
              }));
            };
            
            console.warn = function(...args) {
              originalWarn.apply(console, args);
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'console',
                level: 'warn',
                message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
              }));
            };
          })();
          true;
        `}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        style={styles.webview}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        cacheEnabled={false}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('❌ WebView error:', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('❌ WebView HTTP error:', nativeEvent);
        }}
        onLoadStart={() => console.log('🔄 WebView loading started')}
        onLoadEnd={() => console.log('✅ WebView loading finished')}
      />
    </View>
  );
});

export default AvatarViewer3D;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
