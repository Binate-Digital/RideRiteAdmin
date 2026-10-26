FROM node:22

WORKDIR /app

EXPOSE 5173

#CMD tail -f /dev/null

# Default: production build served by `vite preview` (bundled + minified; the dev server
# compiled every module on request). The build runs at container start so VITE_* values
# from the server's env (e.g. VITE_API_URL) are baked in.
# Set START_MODE=dev to run the old Vite dev server instead.
CMD ["sh", "-c", "if [ \"$START_MODE\" = \"dev\" ]; then npm run dev -- --host; else npm run build && npm run preview -- --host --port 5173 --strictPort; fi"]
