'use client';

import { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";

// Chart.jsのコンポーネントを登録
Chart.register(...registerables);

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataPoints = useRef<number[]>([]);
  const [decibels, setDecibels] = useState(0);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const initAudio = async () => {
      try {
        // マイクのストリームを取得
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        if (canvasRef.current) {
          dataPoints.current = Array(canvasRef.current.width).fill(canvasRef.current.height / 2);
        }

        visualize();
      } catch (error) {
        console.error("マイクアクセスエラー:", error);
      }
    };

    const visualize = () => {
      if (!canvasRef.current || !analyserRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const analyser = analyserRef.current;
      const width = canvas.width;
      const height = canvas.height;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      if (!chartRef.current) {
        chartRef.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: Array.from({ length: width }, (_, i) => i),
            datasets: [{
              label: '音量波線グラフ',
              data: dataPoints.current,
              borderColor: 'blue',
              borderWidth: 2,
              fill: false,
            }]
          },
          options: {
            scales: {
              y: {
                beginAtZero: true,
                max: height,
                ticks: {
                  callback: (value) => `${value} dB`
                }
              }
            }
          }
        });
      }

      const draw = () => {
        analyser.getByteTimeDomainData(dataArray);

        // RMS（Root Mean Square）を計算
        const sum = dataArray.reduce((acc, val) => acc + Math.pow(val - 128, 2), 0);
        const rms = Math.sqrt(sum / dataArray.length);
        const decibels = 20 * Math.log10(rms);
        setDecibels(decibels);

        // デシベル値を正規化して画面に描画
        const normalizedValue = Math.max(0, Math.min(1, (decibels + 100) / 100));
        const yValue = height - normalizedValue * height;

        dataPoints.current.push(yValue);
        if (dataPoints.current.length > width) {
          dataPoints.current.shift();
        }

        // Chart.jsでグラフを更新
        if (chartRef.current) {
          chartRef.current.data.datasets[0].data = dataPoints.current;
          chartRef.current.update();
        }

        requestAnimationFrame(draw);
      };

      draw();
    };

    initAudio();

    return () => {
      // クリーンアップ
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  return (
    <div>
      <h1>音量波線グラフ</h1>
      <p>声の大きさ: {decibels.toFixed(2)} dB</p>
      <canvas ref={canvasRef} width={800} height={200} style={{ border: "1px solid #ccc" }}></canvas>
    </div>
  );
}
