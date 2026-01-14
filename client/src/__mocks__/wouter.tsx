import React from "react";

export const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href}>{children}</a>
);

export const useParams = () => ({});
