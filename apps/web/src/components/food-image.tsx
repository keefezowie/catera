import Image, { type ImageProps } from "next/image";

/** Responsive derivatives for approved local art; uploaded/signed URLs keep their existing delivery path. */
export function FoodImage({
  src,
  ...props
}: Omit<ImageProps, "src"> & { src: string }) {
  return (
    <Image
      {...props}
      src={src}
      unoptimized={!src.startsWith("/assets/food/")}
    />
  );
}
