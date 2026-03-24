import LazyImage from "@/components/ui/lazy-image";

interface EmployeeAvatarProps {
  photoUrl?: string;
  avatar?: string;
  avatarColor?: string;
  avatarTextColor?: string;
  firstName?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  rounded?: "lg" | "xl" | "2xl" | "full";
}

const sizeMap = {
  xs: "w-6 h-6 text-[9px]",
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-10 h-10 text-sm",
  xl: "w-14 h-14 text-xl",
};

const EmployeeAvatar = ({
  photoUrl,
  avatar,
  avatarColor = "hsl(200 70% 90%)",
  avatarTextColor = "hsl(200 70% 35%)",
  firstName = "",
  size = "md",
  className = "",
  rounded = "xl",
}: EmployeeAvatarProps) => {
  const dim = sizeMap[size];
  const roundedClass = `rounded-${rounded}`;
  const initials = avatar || firstName?.charAt(0) || "?";

  if (photoUrl) {
    return (
      <LazyImage
        src={photoUrl}
        alt={firstName}
        className={`${dim} ${roundedClass} object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${dim} ${roundedClass} flex items-center justify-center font-bold flex-shrink-0 ${className}`}
      style={{ background: avatarColor, color: avatarTextColor }}
    >
      {initials}
    </div>
  );
};

export default EmployeeAvatar;
