"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ResponsiveSankey } from "@nivo/sankey";
import { Loader2 } from "lucide-react";

export function SankeyFlow() {
  const [data, setData] = useState<any>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const { tokens } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      console.log("SankeyFlow: Fetching data...");
      if (!tokens?.access) {
          console.log("SankeyFlow: No access token");
          setLoading(false);
          return;
      }
      try {
        console.log("SankeyFlow: Making API call");
        const res = await fetch("http://localhost:8000/reports/flow/", {
          headers: { Authorization: `Bearer ${tokens.access}` },
        });
        const result = await res.json();
        console.log("SankeyFlow: Data received", result);
        setData(result);
      } catch (e) {
        console.error("SankeyFlow Error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tokens]);

  if (loading) {
    return (
      <div className="border border-white/15 p-10 h-[500px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/20" />
      </div>
    );
  }

  if (!data.nodes.length || !data.links.length) {
    return (
        <div className="border border-white/15 p-10 h-[200px] flex items-center justify-center text-white/50">
            No transaction data available for this month.
        </div>
    );
  }

  // Dark theme for Nivo
  const theme = {
    text: {
        fill: "#cccccc",
        fontSize: 11,
    },
    tooltip: {
        container: {
            background: "#121212",
            color: "#ffffff",
            fontSize: "12px",
            border: "1px solid #333",
        },
    },
  };

  const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="border border-white/15 p-6 h-[600px] flex flex-col gap-4 sankey-container">
      <style>{`
        .sankey-container path {
          fill: #ffffff !important;
          fill-opacity: 0.3 !important;
          stroke: none !important;
        }
        .sankey-container path:hover {
          fill-opacity: 0.6 !important;
        }
      `}</style>
      <div>
        <h3 className="text-lg font-bold text-white">Cash Flow - {currentMonth}</h3>
        <p className="text-sm text-white/40">Income vs Expenses Flow</p>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveSankey
            data={data}
            theme={theme}
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            align="justify"
            colors={{ scheme: 'category10' }} 
            nodeOpacity={1}
            nodeHoverOthersOpacity={0.35}
            nodeThickness={18}
            nodeSpacing={40}
            nodeBorderWidth={0}
            nodeBorderColor={{
                from: 'color',
                modifiers: [
                    [
                        'darker',
                        0.8
                    ]
                ]
            }}
            linkOpacity={0.2}
            linkHoverOthersOpacity={0.1}
            linkContract={3}
            enableLinkGradient={false}
            linkBlendMode="normal"
            labelPosition="inside"
            labelOrientation="horizontal"
            labelPadding={16}
            labelTextColor={{
                from: 'color',
                modifiers: [
                    [
                        'brighter',
                        1
                    ]
                ]
            }}
            onClick={(data) => console.log('Sankey click:', data)}
        />
      </div>
    </div>
  );
}