import React, { forwardRef } from 'react';

interface ButtonProps {
  onClick?: () => any;
  children: any;
  href?: string;
  Icon?: React.ComponentType<any>;
}

const Button = forwardRef<any, ButtonProps>(({ children, onClick, href, Icon }, ref) => {
  const Element = href ? 'a' : 'button';
  return (
    <Element className="button" onClick={onClick} ref={ref} href={href}>
      {Icon && <Icon size={18} className="icon" />}

      {children}

      <style jsx>{`
        .button {
          padding: 3px 10px 2px;
          border-radius: 3px;
          border: solid 1px #d0d1d9;
          background: transparent;
          font-size: 14px;
          color: #091636;
          height: 30px;
          outline: none;
          display: inline-block;
          text-decoration: none;
          font-family: 'sofia-pro', sans-serif;
          display: flex;
          align-items: center;
        }
        .button:hover {
          background: #eeeeee;
        }
        .button :global(.icon) {
          margin-right: 2px;
        }
      `}</style>
    </Element>
  );
});

export default Button;
