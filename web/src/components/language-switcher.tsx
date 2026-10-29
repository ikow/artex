"use client";

import { Languages } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { chooseLocale, useUILocale } from "@/lib/i18n/react";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useUILocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          aria-label="Language / 语言"
          title="Language / 语言"
          className="shrink-0"
        >
          <Languages className="size-4" />
          {!compact && <span className="hidden sm:inline">{locale === "en" ? "English" : "中文"}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => {
            void chooseLocale(value).catch(() =>
              toast.error(
                value === "zh-CN"
                  ? "语言已更改，但浏览器未允许保存偏好。"
                  : "Language changed, but the browser did not allow saving your preference.",
              ),
            );
          }}
        >
          <DropdownMenuRadioItem value="en" lang="en">English</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="zh-CN" lang="zh-CN">简体中文</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
