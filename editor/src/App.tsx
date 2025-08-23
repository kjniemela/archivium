import { useEffect, useState } from 'react';
import ItemEdit from './pages/ItemEdit';

export type AppProps = NavProps & {
  displayUniverse: string,
  addrPrefix: string,
  domain: string,
};

export type NavProps = {
  itemShort?: string | null,
  storyShort?: string | null,
  universeShort?: string | null,
};

export default function App({ itemShort, storyShort, universeShort, displayUniverse, addrPrefix, domain }: AppProps) {
  const [currenItem, setCurrentItem] = useState<string | null>(itemShort ?? null);
  const [currentStory, setCurrentStory] = useState<string | null>(storyShort ?? null);
  const [currentUniverse, setCurrentUniverse] = useState<string | null>(universeShort ?? null);

  function universeLink(universe: string): string {
    if (displayUniverse) {
      if (displayUniverse === universe) return addrPrefix;
      else return `https://${domain}${addrPrefix}/universes/${universe}`;
    } else {
      return `${addrPrefix}/universes/${universe}`;
    }
  }

  useEffect(() => {
    if (currentStory) {
    } else if (currentUniverse) {
      if (currenItem) {
        history.replaceState(null, '', `${universeLink(currentUniverse)}/items/${currenItem}/edit`);
      } else {

      }
    }
  }, [currenItem, currentStory, currentUniverse]);

  function navigate({ itemShort, storyShort, universeShort }: NavProps) {
    if (itemShort !== undefined) setCurrentItem(itemShort);
    if (storyShort !== undefined) setCurrentStory(storyShort);
    if (universeShort !== undefined) setCurrentUniverse(universeShort);
  }

  if (currentStory) {

  } else if (currentUniverse) {
    if (currenItem) {
      return <>
        <ItemEdit universeShort={currentUniverse} itemShort={currenItem} universeLink={universeLink} navigate={navigate} />
      </>;
    } else {

    }
  }
}
