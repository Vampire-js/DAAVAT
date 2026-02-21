"use client";

import { useGLTF } from "@react-three/drei";

export default function NotebookModel(props: any) {
  const { scene } = useGLTF("/models/notebook.glb");

  return <primitive object={scene} {...props} />;
}

useGLTF.preload("/models/notebook.glb");
