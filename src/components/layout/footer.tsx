
'use client';

import { Separator } from "@/components/ui/separator";
import { Github, Instagram, Youtube } from "lucide-react";

export default function AppFooter() {
  const version = "2.3"; 

  return (
    <footer className="w-full shrink-0">
        <Separator />
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 h-auto sm:h-14 py-4 sm:py-0 text-sm text-muted-foreground gap-4">
            <p>
              Visual Map v{version} - Developed by{' '}
              <a 
                href="https://github.com/afsh4ck" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-primary transition-colors font-medium"
              >
                afsh4ck
              </a>
            </p>
            <div className="flex items-center gap-4">
                <a href="https://github.com/afsh4ck" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    <Github className="h-5 w-5" />
                    <span className="sr-only">GitHub</span>
                </a>
                <a href="https://www.instagram.com/afsh4ck/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    <Instagram className="h-5 w-5" />
                    <span className="sr-only">Instagram</span>
                </a>
                <a href="https://youtube.com/@afsh4ck?sub_confirmation=1" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    <Youtube className="h-5 w-5" />
                    <span className="sr-only">YouTube</span>
                </a>
            </div>
        </div>
    </footer>
  );
}
