import {
  useEffect,
  useRef,
} from "react";

import type { Panel } from "./Panel";


export type LegacyPanelFactory =
  () => Panel;


interface LegacyPanelAdapterProps {
  createPanel: LegacyPanelFactory;
}


function LegacyPanelAdapter(
  {
    createPanel,
  }: LegacyPanelAdapterProps
) {

  const containerRef =
    useRef<HTMLDivElement | null>(null);


  useEffect(() => {

    const panel =
      createPanel();


    const element =
      panel.getElement();


    if (containerRef.current) {

      containerRef.current.replaceChildren(
        element
      );

    }


    return () => {

      try {

        panel.destroy();

      } catch (error) {

        console.warn(
          "Failed to destroy legacy panel:",
          error
        );

      }

    };

  }, [createPanel]);


  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
      }}
    />
  );
}


export function createLegacyPanelComponent(
  factory: LegacyPanelFactory
) {

  return function LegacyPanelComponent() {

    return (
      <LegacyPanelAdapter
        createPanel={factory}
      />
    );

  };

}


export default LegacyPanelAdapter;