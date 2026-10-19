import path from "node:path";



import type { NextConfig } from "next";



const nextConfig: NextConfig = {
  // Separate development and production output, preserving workspace redirects.
  distDir: process.env.NODE_ENV === "development" ? (process.env.CARGOMESH_LOCAL_PROFILE === "fleet80" ? ".next-fleet-scenario" : ".next-dev") : ".next",

  outputFileTracingRoot: path.join(__dirname, ".."),

  poweredByHeader: false,
  async redirects() { return [
    {
        "source": "/v2-workspace",
        "destination": "/carriers",
        "permanent": false
    },
    {
        "source": "/carrier-portal",
        "destination": "/carriers",
        "permanent": false
    },
    {
        "source": "/carrier-control-tower",
        "destination": "/carriers/control-tower",
        "permanent": false
    },
    {
        "source": "/carrier-route-lab",
        "destination": "/carriers/route-lab",
        "permanent": false
    },
    {
        "source": "/demo/shipper/dashboard",
        "destination": "/clients",
        "permanent": false
    },
    {
        "source": "/demo/shipper",
        "destination": "/clients",
        "permanent": false
    },
    {
        "source": "/demo/shipper/:path*",
        "destination": "/clients/:path*",
        "permanent": false
    },
    {
        "source": "/dashboard",
        "destination": "/clients",
        "permanent": false
    },
    {
        "source": "/requests/:path*",
        "destination": "/clients/requests/:path*",
        "permanent": false
    },
    {
        "source": "/freight-request/:path*",
        "destination": "/clients/freight-request/:path*",
        "permanent": false
    },
    {
        "source": "/facilities/:path*",
        "destination": "/clients/facilities/:path*",
        "permanent": false
    },
    {
        "source": "/bookings/:path*",
        "destination": "/clients/bookings/:path*",
        "permanent": false
    },
    {
        "source": "/tracking/:path*",
        "destination": "/clients/tracking/:path*",
        "permanent": false
    },
    {
        "source": "/history/:path*",
        "destination": "/clients/history/:path*",
        "permanent": false
    },
    {
        "source": "/organization/:path*",
        "destination": "/clients/organization/:path*",
        "permanent": false
    },
    {
        "source": "/support/:path*",
        "destination": "/clients/support/:path*",
        "permanent": false
    },
    {
        "source": "/help/:path*",
        "destination": "/clients/help/:path*",
        "permanent": false
    }
]; },

};



export default nextConfig;
