import { useEffect, useState } from 'react';

type SearchableSelectProps = {
  options: { [shortname: string]: string },
  onSelect: (selectedValue: string) => void,
  groups?: { [shortname: string]: string },
};

export default function SearchableSelect({ options, onSelect, groups }: SearchableSelectProps) {
  const [searchText, setSearchText] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);

  groups = groups ?? {};

  useEffect(() => {
    if (selectedKey) onSelect(selectedKey);
  }, [selectedKey]);

  const ungroupedOptions = Object.keys(options).filter(key => !(key in groups));
  const groupedOptions = Object.keys(options).filter(key => (key in groups));
  const optionGroups: { [key: string]: string[] } = {};
  for (const key of groupedOptions) {
    if (!(groups[key] in optionGroups)) optionGroups[groups[key]] = [];
    optionGroups[groups[key]].push(key);
  }

  const createOption = (key: string) => {
    return <div key={key} className='option' onClick={() => {
      setSearchText(options[key]);
      setSelectedKey(key);
    }}>{options[key]}</div>;
  };
  
  return <div className='searchable-select'>
    <input
      value={searchText}
      onChange={({ target }) => setSearchText(target.value)}
      onFocus={() => setDropdownVisible(true)}
      onBlur={() => setTimeout(() => setDropdownVisible(false), 100)} // Timeout to allow click event to register
    />
    <div className='options-container' style={{ display: dropdownVisible ? 'block' : 'none' }}>
      {ungroupedOptions.map((key) => createOption(key))}
      {Object.keys(optionGroups).map((group) => (
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
