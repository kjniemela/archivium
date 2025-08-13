type TabsBarProps = {
  tabs: { [tab: string]: string },
  selectedTab: string | null,
  onSelectTab: (tab: string) => void,
  onRemoveTab: (tab: string) => void,
};

export default function TabsBar({ tabs, selectedTab, onSelectTab, onRemoveTab }: TabsBarProps) {
  return (
    <ul className='tabs-buttons navbarBtns gap-1 grow-1'>
      {Object.entries(tabs).map(([tab, name]) => (
        <li className={`navbarBtn badge-anchor${tab === selectedTab ? ' selected' : ''}`} onClick={() => onSelectTab(tab)} key={tab}>
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
