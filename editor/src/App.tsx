import { useState, useEffect } from 'react';
import ItemEdit from './pages/ItemEdit';

export type AppProps = {
  itemShort: string,
  universeShort: string,
  displayUniverse: string,
  addrPrefix: string,
  domain: string,
};

export default function App({ itemShort, universeShort, displayUniverse, addrPrefix, domain }: AppProps) {
  function universeLink(universe: string): string {
    if (displayUniverse) {
      if (displayUniverse === universe) return addrPrefix;
      else return `https://${domain}${addrPrefix}/universes/${universe}`;
    } else {
      return `${addrPrefix}/universes/${universe}`;
    }
  }

  return (
    <>
      <ItemEdit universeShort={universeShort} itemShort={itemShort} universeLink={universeLink} />
    </>
  );
}
