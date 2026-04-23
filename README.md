# AI Creative Studio
AI Image Generation Studio powered by NVIDIA NIM — Flux 2 Models

## Features
- Generate images using Flux 2 Pro, Dev, Flex, and Klein models
- Multiple aspect ratios (1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3)
- Style presets (Photorealistic, Anime, Cinematic, etc.)
- Custom seed for reproducible results
- Generate up to 4 images at once
- Image gallery with lightbox view
- Download generated images

## Setup
1. Clone this repo
2. Run `npm install`
3. Set your NVIDIA API key:
   ```
   NVIDIA_API_KEY=nvapi-your-key-here
   ```
4. Run `npm run dev`

## NVIDIA NIM API
- Free tier: 5,000 requests/day
- Sign up at https://build.nvidia.com/
- Get your API key from the dashboard

## Tech Stack
- Next.js 15
- React 19
- Tailwind CSS 4
- NVIDIA NIM API
