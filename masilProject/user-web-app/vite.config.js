import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // https: {
    //   key: fs.readFileSync('./localhost+3-key.pem'), // 생성된 key 파일 경로
    //   cert: fs.readFileSync('./localhost+3.pem'),   // 생성된 cert 파일 경로
    // },
    // proxy: {
    //   // '/map-geocode'로 시작하는 요청을 Naver API로 전달합니다.
    //   '/map-geocode': {
    //     target: 'https://maps.apigw.ntruss.com',
    //     changeOrigin: true,
    //   },
    // },
    host: true,
    allowedHosts: ['.ngrok.app']
  },
})
