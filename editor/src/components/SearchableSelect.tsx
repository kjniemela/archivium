import { useEffect, useState } from 'react';

type SearchableSelectProps = {
  id?: string,
  options: { [shortname: string]: string },
  onSelect: (selectedValue: string) => void,
  groups?: { [shortname: string]: string },
  groupPriority?: { [group: string]: number },
};

export default function SearchableSelect({ id, options, onSelect, groups, groupPriority }: SearchableSelectProps) {
  const [searchText, setSearchText] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);

  groups = groups ?? {};
  groupPriority = groupPriority ?? {};

  useEffect(() => {
    if (selectedKey !== null) onSelect(selectedKey);
  }, [selectedKey]);

  const filteredOptions = Object.keys(options).filter(option => (!searchText || !options[option] || options[option].toLowerCase().includes(searchText.toLowerCase())));

  const ungroupedOptions = filteredOptions.filter(key => !(key in groups));
  const groupedOptions = filteredOptions.filter(key => (key in groups));
  const optionGroups: { [key: string]: string[] } = {};
  for (const key of groupedOptions) {
    if (!(groups[key] in optionGroups)) optionGroups[groups[key]] = [];
    optionGroups[groups[key]].push(key);
  }

  const createOption = (key: string) => {
    return <div key={key} className='option' onClick={() => {
      setSearchText(options[key]);
      setSelectedKey(key);
      setDropdownVisible(false);
    }}>{options[key]}</div>;
  };
  
  return <div id={id} className='searchable-select'>
    <input
      value={searchText}
      onChange={({ target }) => setSearchText(target.value)}
      onFocus={() => setDropdownVisible(true)}
      onBlur={() => setTimeout(() => setDropdownVisible(false), 100)} // Timeout to allow click event to register
    />
    <div className='options-container' style={{ display: dropdownVisible ? 'block' : 'none' }}>
      {ungroupedOptions.map((key) => createOption(key))}
      {Object.keys(optionGroups).sort((a, b) => ((groupPriority[a] ?? 0) > (groupPriority[b] ?? 0) ? -1 : 1)).map((group) => (
        <>
          <div key={group} className='option-group-heading'>
            <b>{group}</b>
          </div>
          {optionGroups[group].map((key) => createOption(key))}
        </>
      ))}
    </div>
  </div>;
}
