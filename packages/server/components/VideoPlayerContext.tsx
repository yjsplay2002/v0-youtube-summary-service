"use client"

import React, { createContext, useContext } from "react";

export type VideoPlayerContextType = {
  seekTo: (seconds: number) => void;
};

export const VideoPlayerContext = createContext<VideoPlayerContextType>({
  seekTo: () => {},
});

export const useVideoPlayer = () => useContext(VideoPlayerContext);

export const VideoPlayerProvider = VideoPlayerContext.Provider;
