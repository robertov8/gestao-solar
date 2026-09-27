//go:build dev

package web

import "io/fs"

// Assets retorna nil no build dev: o frontend é servido pelo Vite.
func Assets() fs.FS {
	return nil
}
