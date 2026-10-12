import type { ImageProps } from "next/image";
export default function Image({ alt }: ImageProps) { return <span role="img" aria-label={alt} />; }
