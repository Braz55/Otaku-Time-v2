import React from 'react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';

interface AnimatedPageProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
}

const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
    scale: 0.995,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.995,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

export const AnimatedPage: React.FC<AnimatedPageProps> = ({ children, className = '', ...props }) => {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedPage;
