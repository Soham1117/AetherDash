import { AspectRatio } from "@/components/ui/aspect-ratio";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
}

export function VideoPlayer({
  src,
  poster,
  title = "Video",
}: VideoPlayerProps) {
  return (
    <div className="w-full max-w-3xl flex flex-col items-start justify-start my-6">
      <AspectRatio
        ratio={16 / 9}
        className="bg-muted overflow-hidden rounded-lg border"
      >
        <video
          className="h-full w-full"
          controls
          poster={poster}
          preload="metadata"
          title={title}
        >
          <source src={src} />
          Your browser does not support the video tag.
        </video>
      </AspectRatio>
    </div>
  );
}
