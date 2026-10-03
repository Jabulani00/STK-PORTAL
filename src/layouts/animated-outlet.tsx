import { motion, useReducedMotion } from 'framer-motion'
import { Outlet } from 'react-router-dom'

export function AnimatedOutlet() {
  const reduce = useReducedMotion()
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <Outlet />
    </motion.div>
  )
}
