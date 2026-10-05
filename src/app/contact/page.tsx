import type { Metadata } from "next";
import ContactForm from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to StorageAds. Leave your name and number, or email blake@storageads.com.",
  openGraph: {
    title: "Contact | StorageAds",
    description:
      "Talk to StorageAds. Leave your name and number, or email blake@storageads.com.",
    url: "https://storageads.com/contact",
  },
};

export default function ContactPage() {
  return <ContactForm />;
}
