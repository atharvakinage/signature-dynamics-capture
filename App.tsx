import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Button, 
  Alert,
  SafeAreaView,
} from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { WebViewMessageEvent } from 'react-native-webview';

interface StrokePoint {
  x: number;
  y: number;
  timestamp: number;
  pressure?: number;  // Added pressure if available
}

interface StrokeMetric {
  timestamp: number;
  x: number;
  y: number;
  velocity: number;
  acceleration: number;
  pressure?: number;
  direction?: number;  
  strokeNumber: number;  // Added stroke number to differentiate between strokes
}

const App = () => {
  const signatureRef = useRef<SignatureViewRef>(null);
  const [strokeData, setStrokeData] = useState<StrokeMetric[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<{
    points: StrokePoint[];
    startTime: number | null;
    strokeNumber: number;
  }>({
    points: [],
    startTime: null,
    strokeNumber: 0
  });

  const calculateVelocity = (point1: StrokePoint, point2: StrokePoint): number => {
    const timeDiff = (point2.timestamp - point1.timestamp) / 1000; // Convert to seconds
    if (timeDiff === 0) return 0;

    const distance = Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
    return distance / timeDiff; // Returns velocity in pixels per second
  };

  const calculateAcceleration = (velocity1: number, velocity2: number, timeDiff: number): number => {
    if (timeDiff === 0) return 0;
    return (velocity2 - velocity1) / timeDiff; // Returns acceleration in pixels per second squared
  };

  const calculateDirection = (point1: StrokePoint, point2: StrokePoint): number => {
    return Math.atan2(point2.y - point1.y, point2.x - point1.x) * (180 / Math.PI);
  };

  const handleStrokeStart = () => {
    const timestamp = Date.now();
    setCurrentStroke(prev => ({
      points: [],
      startTime: timestamp,
      strokeNumber: prev.strokeNumber + 1
    }));
  };

  const handleStroke = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'strokeStart':
          handleStrokeStart();
          break;
        case 'strokeMove':
          const { x, y, pressure } = data;
          const timestamp = Date.now();
          setCurrentStroke(prev => ({
            ...prev,
            points: [...prev.points, {
              x,
              y,
              timestamp,
              pressure: pressure || undefined
            }],
          }));
          break;
        case 'strokeEnd':
          handleStrokeEnd();
          break;
      }
    } catch (error) {
      console.error('Error parsing stroke event:', error);
    }
  };

  const handleStrokeEnd = () => {
    if (currentStroke.points.length < 2) return; // Ignore single point strokes
    
    const metrics = calculateStrokeMetrics(currentStroke.points, currentStroke.strokeNumber);
    setStrokeData(prev => [...prev, metrics]);
  };

  const calculateStrokeMetrics = (points: StrokePoint[], strokeNumber: number): StrokeMetric[] => {
    const metrics: StrokeMetric[] = [];
    let prevVelocity = 0;
    
    for (let i = 1; i < points.length; i++) {
      const point1 = points[i - 1];
      const point2 = points[i];
      const timeDiff = (point2.timestamp - point1.timestamp) / 1000; // Convert to seconds
      
      const velocity = calculateVelocity(point1, point2);
      const direction = calculateDirection(point1, point2);
      
      let acceleration = 0;
      if (i > 1) {
        acceleration = calculateAcceleration(prevVelocity, velocity, timeDiff);
      }
      
      prevVelocity = velocity;
      
      metrics.push({
        timestamp: point2.timestamp,
        x: point2.x,
        y: point2.y,
        velocity,
        acceleration,
        pressure: point2.pressure,
        direction,
        strokeNumber
      });
    }
    
    return metrics;
  };

  const saveSignature = async () => {
    try {
      if (!signatureRef.current) {
        throw new Error('Signature pad reference not available');
      }

      if (!signatureRef.current) {
        console.log("Signature pad reference is not available");
        return;
      }
  
      const signatureImage = await signatureRef.current.readSignature();

      console.log(signatureImage)

      const csvHeader = 'timestamp,strokeNumber,x,y,velocity,acceleration,direction,pressure\n';
      const csvData = strokeData
        .flat()
        .map(metric => 
          `${metric.timestamp},${metric.strokeNumber},${metric.x},${metric.y},` +
          `${metric.velocity.toFixed(2)},${metric.acceleration.toFixed(2)},` +
          `${metric.direction?.toFixed(2) || ''},${metric.pressure || ''}`
        )
        .join('\n');
  
      const response = await fetch('http://172.16.2.49:3000/save-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: signatureImage,
          metrics: csvHeader + csvData,
          timestamp: Date.now(),
        }),
      });
  
      if (response.ok) {
        Alert.alert('Success', 'Signature dynamics and image saved successfully');
      } else {
        throw new Error('Failed to save files');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        Alert.alert('Error', 'Failed to save signature: ' + error.message);
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    }
  };
  

  const style = `.m-signature-pad {
    box-shadow: none;
    border: 1px solid #e8e8e8;
  }
  .m-signature-pad--body {
    border: none;
  }
  .m-signature-pad--footer {
    display: none;
  }`;


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.signaturePad}>
        <SignatureScreen
          ref={signatureRef}
          onBegin={handleStrokeStart}
          onEnd={handleStrokeEnd}
          //onMessage={handleStroke}
          onOK={(signature) => handleStroke({ nativeEvent: { data: JSON.stringify({ type: 'strokeEnd', signature }) } } as WebViewMessageEvent)}
          webStyle={style}
          autoClear={false}
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button 
          title="Clear" 
          onPress={() => {
            signatureRef.current?.clearSignature();
            setStrokeData([]);
          }} 
        />
        <Button title="Save" onPress={saveSignature} />
      </View>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  signaturePad: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
});

export default App;