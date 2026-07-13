"use client";

import { useRef } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import Button from "./Button";
import { useToast } from "./Toast";
import { useAvatar, setAvatar, removeAvatar } from "@/lib/avatar-store";

export interface AvatarUploaderProps {
  email: string;
  name: string;
  size?: number;
}

// Reusable profile-picture editor: shows the current avatar (or an initial
// fallback) with change / remove controls. Used on the merchant profile and
// admin settings pages.
export default function AvatarUploader({
  email,
  name,
  size = 88,
}: AvatarUploaderProps) {
  const toast = useToast();
  const avatar = useAvatar(email);
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = (name || "U").charAt(0).toUpperCase();

  const onPick = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(email, reader.result as string);
      toast.success("Profile picture updated");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-semibold text-white ring-2 ring-brown-100"
        >
          {avatar ? (
            <Image
              src={avatar}
              alt={name}
              width={size}
              height={size}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            initial
          )}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow hover:bg-primary-700"
          aria-label="Change profile picture"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            {avatar ? "Change Photo" : "Upload Photo"}
          </Button>
          {avatar && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                removeAvatar(email);
                toast.success("Profile picture removed");
              }}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-brown-500">PNG or JPG, up to 2MB.</p>
      </div>
    </div>
  );
}
