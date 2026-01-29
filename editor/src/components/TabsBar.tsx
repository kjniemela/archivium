import type { DocUser } from '../hooks/useProvider';

type TabsBarProps = {
  tabs: { [tab: string]: string },
  selectedTab: string | null,
  onSelectTab: (tab: string) => void,
  onRemoveTab: (tab: string) => void,
  selectors: { [el: string]: DocUser[] },
};

export default function TabsBar({ tabs, selectedTab, onSelectTab, onRemoveTab, selectors }: TabsBarProps) {
  return (
    <ul className='tabs-buttons navbarBtns gap-1 grow-1 flex-wrap'>
      {Object.entries(tabs).map(([tab, name]) => (
        <li
          key={tab}
          className={`navbarBtn badge-anchor${tab === selectedTab ? ' selected' : ''}`}
          data-tab={tab}
          onClick={() => onSelectTab(tab)}
        >
          {selectors[tab] && selectors[tab].map((user, i) => (
            <img key={user.clientId} src={user.pfp} className='badge' style={{
              left: `${-0.5 + (0.5 * i)}rem`,
              backgroundColor: user.color ?? '',
            }} />
          ))}
          <h3 className='navbarBtnLink navbarText ma-0'>{name}</h3>
          {tab === selectedTab && <div className='material-symbols-outlined badge badge-large' onClick={(e) => {
            e.stopPropagation();
            onRemoveTab(tab);
          }}>delete</div>}
        </li>
      ))}
    </ul>
  );
}
