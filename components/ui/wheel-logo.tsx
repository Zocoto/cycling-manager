import Image from "next/image";

type WheelLogoProps = {
  className?: string;
};

export function WheelLogo({ className = "h-9 w-9" }: WheelLogoProps) {
  return (
    <Image
      src="/logo-cyclo-stratege.png"
      alt=""
      aria-hidden="true"
      width={72}
      height={72}
      priority
      className={`block shrink-0 ${className}`}
    />
  );
}
