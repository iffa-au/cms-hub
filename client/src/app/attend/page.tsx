import type { Metadata } from "next";

import AttendForm from "@/components/attend/attend-form";

export const metadata: Metadata = {
  title: "Attend IFFA 2026 | Request your seat",
  description:
    "Request a seat at the IFFA 2026 awards night as a creator, media/press or general audience member.",
};

export default function AttendPage() {
  return <AttendForm />;
}
