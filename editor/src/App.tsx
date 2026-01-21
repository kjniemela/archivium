import { Route, Routes } from 'react-router';
import ChapterEdit from './pages/ChapterEdit';
import ItemEdit from './pages/ItemEdit';

export type AppProps = {
  displayUniverse: string,
  addrPrefix: string,
  domain: string,
};

export default function App({ displayUniverse, addrPrefix, domain }: AppProps) {
  function universeLink(universe: string): string {
    if (displayUniverse) {
      if (displayUniverse === universe) return addrPrefix;
      else return `https://${domain}${addrPrefix}/universes/${universe}`;
    } else {
      return `${addrPrefix}/universes/${universe}`;
    }
  }

  return (
    <Routes>
      <Route path='editor'>
        <Route path='universes'>
          <Route path=':universeShort'>
            <Route path='items'>
              <Route path=':itemShort' element={<ItemEdit universeLink={universeLink} domain={domain} />} />
            </Route>
          </Route>
        </Route>
        <Route path='stories'>
          <Route path=':storyShort'>
            <Route path=':chapterIndex' element={<ChapterEdit universeLink={universeLink} />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
